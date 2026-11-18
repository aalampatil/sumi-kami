import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, sql, withAuthorizedWorkspace, type TenantDatabase } from "@repo/database";
import { withPublicFormLookup } from "@repo/database/public-form";
import { getTenantDatabase } from "@repo/database/runtime";
import {
  answerSelectionsTable,
  answerFilesTable,
  fieldOptionsTable,
  formFieldsTable,
  formsTable,
  formSubmissionsTable,
  submissionAnswersTable,
  submissionFilesTable,
  workspacesTable,
} from "@repo/database/schema";
import {
  allFields,
  publicationIssues,
  type Answers,
  type FormDefinition,
} from "@repo/form-core/definition";
import { formPath, validateAnswers } from "@repo/form-core/answers";
import { readDefinition } from "./persistence";
import { FormError, missingForm } from "./errors";
import {
  publicSlugSchema,
  submitFormSchema,
  type PublishedForm,
  type SubmitFormInput,
} from "./model";
import {
  LocalPrivateFileStore,
  prepareUploads,
  type IncomingUpload,
  type PrivateFileStore,
} from "./files";

export function requestDigest(
  definition: FormDefinition,
  answers: Answers,
  uploads: ReturnType<typeof prepareUploads> = [],
): string {
  const visible = formPath(definition, answers).answers;
  const canonical = allFields(definition)
    .filter((field) => Object.hasOwn(visible, field.key))
    .map((field) => {
      let value = answers[field.key]!;
      if (field.type === "FILE" && Array.isArray(value))
        value = uploads
          .filter((file) => file.fieldKey === field.key)
          .map((file) => file.checksum + ":" + file.name)
          .sort();
      else if (Array.isArray(value)) value = [...value].sort();
      else if (field.type === "EMAIL" && typeof value === "string") value = value.trim();
      else if (["NUMBER", "RATING"].includes(field.type) && typeof value === "string")
        value = value
          .replace(/(\.\d*?[1-9])0+$/, "$1")
          .replace(/\.0+$/, "")
          .replace(/^-0$/, "0");
      return { key: field.key, value };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
export class PublicFormService {
  constructor(
    private readonly database: () => TenantDatabase = getTenantDatabase,
    private readonly fileStore: PrivateFileStore = new LocalPrivateFileStore(),
  ) {}
  async reference(slug: string): Promise<{ workspaceId: string; formId: string }> {
    publicSlugSchema.parse(slug);
    return withPublicFormLookup(this.database(), slug, async (transaction) => {
      const [form] = await transaction
        .select({ workspaceId: formsTable.workspaceId, formId: formsTable.id })
        .from(formsTable)
        .where(and(eq(formsTable.slug, slug), isNull(formsTable.deletedAt)))
        .limit(1);
      if (!form) missingForm();
      return form;
    });
  }
  async get(slug: string): Promise<PublishedForm> {
    const reference = await this.reference(slug);
    return withAuthorizedWorkspace(this.database(), reference.workspaceId, async (transaction) => {
      const [workspace] = await transaction
        .select({ id: workspacesTable.id })
        .from(workspacesTable)
        .where(
          and(eq(workspacesTable.id, reference.workspaceId), isNull(workspacesTable.deletedAt)),
        )
        .for("share");
      const [form] = await transaction
        .select()
        .from(formsTable)
        .where(
          and(
            eq(formsTable.id, reference.formId),
            eq(formsTable.workspaceId, reference.workspaceId),
            isNull(formsTable.deletedAt),
            isNull(formsTable.archivedAt),
          ),
        )
        .for("share");
      if (!workspace || !form?.publishedVersionId) missingForm();
      const definition = await readDefinition(
        transaction,
        reference.workspaceId,
        form.publishedVersionId,
      );
      if (publicationIssues(definition).length) missingForm();
      return { slug: form.slug, versionId: form.publishedVersionId, definition };
    });
  }
  async submit(request: SubmitFormInput, incomingUploads: IncomingUpload[] = []) {
    const input = submitFormSchema.parse(request),
      reference = await this.reference(input.slug);
    if (new Set(input.answers.map((answer) => answer.fieldKey)).size !== input.answers.length)
      throw new FormError("INVALID", "Answer each question only once.");
    const answers: Answers = Object.fromEntries(
      input.answers.map((answer) => [answer.fieldKey, answer.value]),
    );
    const uploads = prepareUploads(incomingUploads),
      written: string[] = [];
    try {
      return await withAuthorizedWorkspace(
        this.database(),
        reference.workspaceId,
        async (transaction) => {
          const [workspace] = await transaction
            .select({ id: workspacesTable.id })
            .from(workspacesTable)
            .where(
              and(eq(workspacesTable.id, reference.workspaceId), isNull(workspacesTable.deletedAt)),
            )
            .for("share");
          const [form] = await transaction
            .select()
            .from(formsTable)
            .where(
              and(
                eq(formsTable.id, reference.formId),
                eq(formsTable.workspaceId, reference.workspaceId),
                isNull(formsTable.deletedAt),
              ),
            )
            .for("share");
          if (!workspace || !form) missingForm();
          await transaction.execute(
            sql`SELECT pg_advisory_xact_lock(hashtextextended(${form.id + ":" + input.idempotencyKey},0))`,
          );
          const [existing] = await transaction
            .select({
              id: formSubmissionsTable.id,
              versionId: formSubmissionsTable.versionId,
              status: formSubmissionsTable.status,
              metadata: formSubmissionsTable.metadata,
              completedAt: formSubmissionsTable.completedAt,
              deletedAt: formSubmissionsTable.deletedAt,
              expired: sql<boolean>`${formSubmissionsTable.expiresAt} IS NOT NULL AND ${formSubmissionsTable.expiresAt}<=clock_timestamp()`,
            })
            .from(formSubmissionsTable)
            .where(
              and(
                eq(formSubmissionsTable.workspaceId, reference.workspaceId),
                eq(formSubmissionsTable.formId, form.id),
                eq(formSubmissionsTable.idempotencyKey, input.idempotencyKey),
              ),
            )
            .for("update");
          if (
            existing &&
            (existing.versionId !== input.versionId || existing.status !== "COMPLETED")
          )
            throw new FormError(
              "CONFLICT",
              "This submission attempt was already used for another response.",
            );
          if (existing?.deletedAt || existing?.expired)
            throw new FormError("NOT_FOUND", "This submission receipt is no longer available.");
          if (!existing && (form.archivedAt || !form.publishedVersionId)) missingForm();
          if (!existing && form.publishedVersionId !== input.versionId)
            throw new FormError("CONFLICT", "This form was updated. Reload it before submitting.");
          const definition = await readDefinition(
            transaction,
            reference.workspaceId,
            input.versionId,
          );
          const fields = allFields(definition);
          for (const upload of uploads) {
            const field = fields.find((field) => field.key === upload.fieldKey);
            if (!field || field.type !== "FILE")
              throw new FormError("INVALID", "An attachment does not belong to a file question.");
            if (
              upload.bytes.length > (field.configuration.maxBytes ?? 5242880) ||
              !(
                field.configuration.accept ?? [
                  "image/png",
                  "image/jpeg",
                  "image/webp",
                  "application/pdf",
                  "text/plain",
                ]
              ).includes(upload.mediaType)
            )
              throw new FormError(
                "INVALID",
                field.label + ": check the allowed file size and type.",
              );
          }
          for (const field of fields.filter((field) => field.type === "FILE")) {
            const selected = uploads.filter((file) => file.fieldKey === field.key);
            if (
              !selected.length &&
              Array.isArray(answers[field.key]) &&
              (answers[field.key] as string[]).length
            )
              throw new FormError(
                "INVALID",
                "Send file bytes with your response; existing file IDs cannot be attached.",
              );
            if (selected.length) answers[field.key] = selected.map((file) => file.id);
          }
          const path = formPath(definition, answers);
          if (uploads.some((file) => !path.fields.some((field) => field.key === file.fieldKey)))
            throw new FormError("INVALID", "Remove attachments from hidden or skipped questions.");
          const issues = validateAnswers(definition, answers);
          if (issues.length) {
            const issue = issues[0]!,
              field = allFields(definition).find((field) => field.key === issue.fieldKey);
            throw new FormError("INVALID", (field ? field.label + ": " : "") + issue.message);
          }
          const requestHash = requestDigest(definition, answers, uploads);
          if (existing) {
            if (existing.metadata.requestHash !== requestHash)
              throw new FormError(
                "CONFLICT",
                "This submission attempt already contains different answers.",
              );
            return {
              id: existing.id,
              title: definition.settings.completionTitle,
              message: definition.settings.completionMessage,
              completedAt: existing.completedAt!.toISOString(),
            };
          }
          const submissionId = randomUUID();
          await transaction.insert(formSubmissionsTable).values({
            id: submissionId,
            workspaceId: reference.workspaceId,
            formId: form.id,
            versionId: input.versionId,
            idempotencyKey: input.idempotencyKey,
            metadata: { requestHash },
          });
          const storedFields = await transaction
            .select()
            .from(formFieldsTable)
            .where(
              and(
                eq(formFieldsTable.workspaceId, reference.workspaceId),
                eq(formFieldsTable.versionId, input.versionId),
              ),
            );
          const options = await transaction
            .select()
            .from(fieldOptionsTable)
            .where(
              and(
                eq(fieldOptionsTable.workspaceId, reference.workspaceId),
                eq(fieldOptionsTable.versionId, input.versionId),
              ),
            );
          for (const field of path.fields) {
            const value = path.answers[field.key];
            if (
              value === undefined ||
              (value === "" && !["SHORT_TEXT", "LONG_TEXT"].includes(field.type)) ||
              (Array.isArray(value) && !value.length)
            )
              continue;
            const persisted = storedFields.find((row) => row.key === field.key)!,
              answerId = randomUUID();
            const common = {
              id: answerId,
              workspaceId: reference.workspaceId,
              versionId: input.versionId,
              submissionId,
              fieldId: persisted.id,
            };
            if (["SINGLE_SELECT", "DROPDOWN", "MULTI_SELECT"].includes(field.type)) {
              await transaction.insert(submissionAnswersTable).values({
                ...common,
                storageKind: field.type === "MULTI_SELECT" ? "MULTI_SELECT" : "SINGLE_SELECT",
              });
              const selected = Array.isArray(value) ? value : [value as string];
              await transaction.insert(answerSelectionsTable).values(
                selected.map((key) => ({
                  workspaceId: reference.workspaceId,
                  versionId: input.versionId,
                  answerId,
                  fieldId: persisted.id,
                  optionId: options.find(
                    (option) => option.fieldId === persisted.id && option.key === key,
                  )!.id,
                })),
              );
            } else if (field.type === "FILE") {
              await transaction
                .insert(submissionAnswersTable)
                .values({ ...common, storageKind: "FILE" });
              for (const upload of uploads.filter((file) => file.fieldKey === field.key)) {
                await this.fileStore.put(upload.objectKey, upload.bytes);
                written.push(upload.objectKey);
                await transaction.insert(submissionFilesTable).values({
                  id: upload.id,
                  workspaceId: reference.workspaceId,
                  versionId: input.versionId,
                  submissionId,
                  objectKey: upload.objectKey,
                  originalFilename: upload.name,
                  mediaType: upload.mediaType,
                  byteCount: BigInt(upload.bytes.length),
                  checksum: upload.checksum,
                  uploadState: "READY",
                });
                await transaction.insert(answerFilesTable).values({
                  workspaceId: reference.workspaceId,
                  versionId: input.versionId,
                  submissionId,
                  answerId,
                  fileId: upload.id,
                });
              }
            } else if (field.type === "CHECKBOX")
              await transaction
                .insert(submissionAnswersTable)
                .values({ ...common, storageKind: "BOOLEAN", valueBoolean: value as boolean });
            else if (["NUMBER", "RATING"].includes(field.type))
              await transaction
                .insert(submissionAnswersTable)
                .values({ ...common, storageKind: "NUMBER", valueNumber: value as string });
            else if (field.type === "DATE")
              await transaction
                .insert(submissionAnswersTable)
                .values({ ...common, storageKind: "DATE", valueDate: value as string });
            else if (field.type === "DATETIME")
              await transaction.insert(submissionAnswersTable).values({
                ...common,
                storageKind: "DATETIME",
                valueDatetime: new Date(value as string),
              });
            else if (field.type === "STRUCTURED")
              await transaction.insert(submissionAnswersTable).values({
                ...common,
                storageKind: "JSON",
                valueJson: JSON.parse(value as string) as unknown,
              });
            else
              await transaction.insert(submissionAnswersTable).values({
                ...common,
                storageKind: "TEXT",
                valueText: field.type === "EMAIL" ? (value as string).trim() : (value as string),
              });
          }
          const [completed] = await transaction
            .update(formSubmissionsTable)
            .set({ status: "COMPLETED", completedAt: sql`clock_timestamp()` })
            .where(eq(formSubmissionsTable.id, submissionId))
            .returning({ completedAt: formSubmissionsTable.completedAt });
          return {
            id: submissionId,
            title: definition.settings.completionTitle,
            message: definition.settings.completionMessage,
            completedAt: completed!.completedAt!.toISOString(),
          };
        },
      );
    } catch (error) {
      const cleanup = await Promise.allSettled(written.map((key) => this.fileStore.remove(key)));
      if (cleanup.some((result) => result.status === "rejected"))
        console.error(
          "Private attachment rollback cleanup failed; reconcile private storage with submission_files.",
        );
      throw error;
    }
  }
}
