import { randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  isNull,
  sql,
  type TenantDatabase,
  type WorkspaceTransaction,
} from "@repo/database";
import { getTenantDatabase } from "@repo/database/runtime";
import { formsTable, formVersionsTable, workspacesTable } from "@repo/database/schema";
import {
  definitionSchema,
  newDefinition,
  publicationIssues,
  type FormDefinition,
} from "@repo/form-core/definition";
import { withWorkspaceAccess } from "../workspaces/access";
import { hasWorkspaceCapability } from "../workspaces/permissions";
import type { WorkspaceRole } from "../workspaces/model";
import { FormError, missingForm } from "./errors";
import {
  archiveFormSchema,
  formCreateSchema,
  formListSchema,
  formPublishSchema,
  formSaveSchema,
  formScopeSchema,
  type FormEditor,
  type SaveFormInput,
} from "./model";
import { readDefinition, writeDefinitionChildren } from "./persistence";

export function formSlug(title: string, id: string): string {
  return (
    (title
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50)
      .replace(/-$/g, "") || "form") +
    "-" +
    id.replaceAll("-", "")
  );
}
export async function lockedForm(
  transaction: WorkspaceTransaction,
  workspaceId: string,
  formId: string,
  lock: "share" | "update" = "update",
) {
  const [form] = await transaction
    .select()
    .from(formsTable)
    .where(
      and(
        eq(formsTable.workspaceId, workspaceId),
        eq(formsTable.id, formId),
        isNull(formsTable.deletedAt),
      ),
    )
    .for(lock);
  if (!form) missingForm();
  return form;
}
async function editor(
  transaction: WorkspaceTransaction,
  workspaceId: string,
  formId: string,
  role: WorkspaceRole,
): Promise<FormEditor> {
  const form = await lockedForm(transaction, workspaceId, formId, "share");
  const [version] = await transaction
    .select()
    .from(formVersionsTable)
    .where(
      and(eq(formVersionsTable.workspaceId, workspaceId), eq(formVersionsTable.formId, formId)),
    )
    .orderBy(desc(formVersionsTable.versionNumber))
    .limit(1);
  if (!version) missingForm();
  const [workspace] = await transaction
    .select({ name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  return {
    id: form.id,
    slug: form.slug,
    workspaceId,
    workspaceName: workspace!.name,
    publishedVersionId: form.publishedVersionId,
    archived: Boolean(form.archivedAt),
    canEdit: hasWorkspaceCapability(role, "forms:edit"),
    canPublish: hasWorkspaceCapability(role, "forms:publish"),
    canExport: hasWorkspaceCapability(role, "responses:export"),
    versionId: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    revision: version.revision,
    definition: await readDefinition(transaction, workspaceId, version.id),
  };
}
async function createInTransaction(
  transaction: WorkspaceTransaction,
  workspaceId: string,
  actorUserId: string,
  definition: FormDefinition,
): Promise<string> {
  const id = randomUUID(),
    versionId = randomUUID();
  await transaction
    .insert(formsTable)
    .values({ id, workspaceId, creatorUserId: actorUserId, slug: formSlug(definition.title, id) });
  await transaction.insert(formVersionsTable).values({
    id: versionId,
    workspaceId,
    formId: id,
    versionNumber: 1,
    title: definition.title,
    description: definition.description,
    settings: { ...definition.settings },
  });
  await writeDefinitionChildren(transaction, workspaceId, versionId, definition);
  return id;
}
export class FormService {
  constructor(private readonly database: () => TenantDatabase = getTenantDatabase) {}
  async create(
    actorUserId: string,
    request: { workspaceId: string; title: string },
  ): Promise<FormEditor> {
    const input = formCreateSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:edit",
      async (transaction, role) =>
        editor(
          transaction,
          input.workspaceId,
          await createInTransaction(
            transaction,
            input.workspaceId,
            actorUserId,
            newDefinition(input.title),
          ),
          role,
        ),
    );
  }
  async get(
    actorUserId: string,
    request: { workspaceId: string; formId: string },
  ): Promise<FormEditor> {
    const input = formScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:read",
      (transaction, role) => editor(transaction, input.workspaceId, input.formId, role),
    );
  }
  async list(actorUserId: string, request: ReturnType<typeof formListSchema.parse>) {
    const input = formListSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:read",
      async (transaction) => {
        const records = await transaction
          .select({
            id: formsTable.id,
            slug: formsTable.slug,
            title: sql<string>`(SELECT v.title FROM builder.form_versions v WHERE v.workspace_id=${formsTable.workspaceId} AND v.form_id=${formsTable.id} ORDER BY v.version_number DESC LIMIT 1)`,
            published: sql<boolean>`${formsTable.publishedVersionId} IS NOT NULL`,
            archived: sql<boolean>`${formsTable.archivedAt} IS NOT NULL`,
            hasDraft: sql<boolean>`EXISTS (SELECT 1 FROM builder.form_versions v WHERE v.workspace_id=${formsTable.workspaceId} AND v.form_id=${formsTable.id} AND v.status='DRAFT')`,
            responseCount: sql<number>`(SELECT count(*)::int FROM builder.form_submissions s WHERE s.workspace_id=${formsTable.workspaceId} AND s.form_id=${formsTable.id} AND s.status='COMPLETED' AND s.deleted_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>clock_timestamp()))`,
            createdAt: sql<string>`to_char(${formsTable.createdAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(formsTable)
          .where(
            and(
              eq(formsTable.workspaceId, input.workspaceId),
              isNull(formsTable.deletedAt),
              input.cursorCreatedAt && input.cursorId
                ? sql`(${formsTable.createdAt},${formsTable.id})<(${input.cursorCreatedAt}::timestamptz,${input.cursorId}::uuid)`
                : undefined,
            ),
          )
          .orderBy(desc(formsTable.createdAt), desc(formsTable.id))
          .limit(input.limit + 1);
        const items = records.slice(0, input.limit),
          last = items.at(-1);
        return {
          items,
          nextCursor:
            records.length > input.limit && last
              ? { createdAt: last.createdAt, id: last.id }
              : null,
        };
      },
    );
  }
  async save(actorUserId: string, request: SaveFormInput): Promise<FormEditor> {
    const input = formSaveSchema.parse(request);
    const definition = definitionSchema.parse(input.definition);
    const keys = definition.steps.flatMap((step) => step.fields.map((field) => field.key));
    if (
      new Set(keys).size !== keys.length ||
      new Set(definition.steps.map((step) => step.key)).size !== definition.steps.length
    )
      throw new FormError("INVALID", "Question and step keys must be unique.");
    const structural = publicationIssues(definition, false);
    if (structural.length) throw new FormError("INVALID", structural.slice(0, 3).join(" "));
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:edit",
      async (transaction, role) => {
        const form = await lockedForm(transaction, input.workspaceId, input.formId);
        if (form.archivedAt) throw new FormError("CONFLICT", "Restore this form before editing.");
        const [draft] = await transaction
          .select()
          .from(formVersionsTable)
          .where(
            and(
              eq(formVersionsTable.workspaceId, input.workspaceId),
              eq(formVersionsTable.formId, input.formId),
              eq(formVersionsTable.status, "DRAFT"),
            ),
          )
          .for("update");
        if (!draft || draft.revision !== input.expectedRevision)
          throw new FormError(
            "CONFLICT",
            "This form changed in another session. Reload before saving.",
          );
        await transaction
          .update(formVersionsTable)
          .set({
            title: definition.title,
            description: definition.description,
            settings: { ...definition.settings },
          })
          .where(eq(formVersionsTable.id, draft.id));
        await writeDefinitionChildren(transaction, input.workspaceId, draft.id, definition, true);
        return editor(transaction, input.workspaceId, input.formId, role);
      },
    );
  }
  async publish(
    actorUserId: string,
    request: { workspaceId: string; formId: string; expectedRevision: number },
  ): Promise<FormEditor> {
    const input = formPublishSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:publish",
      async (transaction, role) => {
        const form = await lockedForm(transaction, input.workspaceId, input.formId);
        if (form.archivedAt)
          throw new FormError("CONFLICT", "Restore this form before publishing.");
        const [draft] = await transaction
          .select()
          .from(formVersionsTable)
          .where(
            and(
              eq(formVersionsTable.workspaceId, input.workspaceId),
              eq(formVersionsTable.formId, input.formId),
              eq(formVersionsTable.status, "DRAFT"),
            ),
          )
          .for("update");
        if (!draft || draft.revision !== input.expectedRevision)
          throw new FormError(
            "CONFLICT",
            "This draft changed. Save or reload it before publishing.",
          );
        const definition = await readDefinition(transaction, input.workspaceId, draft.id),
          issues = publicationIssues(definition);
        if (issues.length) throw new FormError("INVALID", issues.slice(0, 3).join(" "));
        await transaction
          .update(formVersionsTable)
          .set({ status: "PUBLISHED", publishedAt: new Date() })
          .where(eq(formVersionsTable.id, draft.id));
        await transaction
          .update(formsTable)
          .set({ publishedVersionId: draft.id })
          .where(eq(formsTable.id, form.id));
        return editor(transaction, input.workspaceId, input.formId, role);
      },
    );
  }
  async edit(
    actorUserId: string,
    request: { workspaceId: string; formId: string },
  ): Promise<FormEditor> {
    const input = formScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:edit",
      async (transaction, role) => {
        const form = await lockedForm(transaction, input.workspaceId, input.formId);
        if (form.archivedAt) throw new FormError("CONFLICT", "Restore this form before editing.");
        const [latest] = await transaction
          .select()
          .from(formVersionsTable)
          .where(
            and(
              eq(formVersionsTable.workspaceId, input.workspaceId),
              eq(formVersionsTable.formId, input.formId),
            ),
          )
          .orderBy(desc(formVersionsTable.versionNumber))
          .limit(1)
          .for("update");
        if (!latest) missingForm();
        if (latest.status === "PUBLISHED") {
          const definition = await readDefinition(transaction, input.workspaceId, latest.id),
            id = randomUUID();
          await transaction.insert(formVersionsTable).values({
            id,
            workspaceId: input.workspaceId,
            formId: input.formId,
            versionNumber: latest.versionNumber + 1,
            title: definition.title,
            description: definition.description,
            settings: { ...definition.settings },
          });
          await writeDefinitionChildren(transaction, input.workspaceId, id, definition);
        }
        return editor(transaction, input.workspaceId, input.formId, role);
      },
    );
  }
  async archive(
    actorUserId: string,
    request: { workspaceId: string; formId: string; archived: boolean },
  ): Promise<FormEditor> {
    const input = archiveFormSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:edit",
      async (transaction, role) => {
        await lockedForm(transaction, input.workspaceId, input.formId);
        await transaction
          .update(formsTable)
          .set({ archivedAt: input.archived ? new Date() : null })
          .where(eq(formsTable.id, input.formId));
        return editor(transaction, input.workspaceId, input.formId, role);
      },
    );
  }
  async unpublish(
    actorUserId: string,
    request: { workspaceId: string; formId: string },
  ): Promise<FormEditor> {
    const input = formScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:publish",
      async (transaction, role) => {
        await lockedForm(transaction, input.workspaceId, input.formId);
        await transaction
          .update(formsTable)
          .set({ publishedVersionId: null })
          .where(eq(formsTable.id, input.formId));
        return editor(transaction, input.workspaceId, input.formId, role);
      },
    );
  }
  async duplicate(
    actorUserId: string,
    request: { workspaceId: string; formId: string },
  ): Promise<FormEditor> {
    const input = formScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:edit",
      async (transaction, role) => {
        const original = await editor(transaction, input.workspaceId, input.formId, role);
        const definition = {
          ...original.definition,
          title: (original.definition.title + " (copy)").slice(0, 200),
        };
        return editor(
          transaction,
          input.workspaceId,
          await createInTransaction(transaction, input.workspaceId, actorUserId, definition),
          role,
        );
      },
    );
  }
  async remove(
    actorUserId: string,
    request: { workspaceId: string; formId: string },
  ): Promise<{ success: true }> {
    const input = formScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "forms:edit",
      async (transaction) => {
        await lockedForm(transaction, input.workspaceId, input.formId);
        await transaction
          .update(formsTable)
          .set({ publishedVersionId: null, deletedAt: new Date(), archivedAt: new Date() })
          .where(eq(formsTable.id, input.formId));
        return { success: true };
      },
    );
  }
}
