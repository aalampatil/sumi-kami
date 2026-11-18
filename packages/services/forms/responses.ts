import { and, desc, eq, inArray, isNull, sql, type TenantDatabase } from "@repo/database";
import { getTenantDatabase } from "@repo/database/runtime";
import {
  answerFilesTable,
  answerSelectionsTable,
  fieldOptionsTable,
  formFieldsTable,
  formSubmissionsTable,
  formVersionsTable,
  submissionAnswersTable,
  submissionFilesTable,
} from "@repo/database/schema";
import { withWorkspaceAccess } from "../workspaces/access";
import { lockedForm } from "./index";
import { FormError } from "./errors";
import { formScopeSchema, responsesInputSchema, type ResponseItem } from "./model";
import { z } from "zod";
import { LocalPrivateFileStore, type PrivateFileStore } from "./files";

export class ResponseService {
  constructor(
    private readonly database: () => TenantDatabase = getTenantDatabase,
    private readonly fileStore: PrivateFileStore = new LocalPrivateFileStore(),
  ) {}
  async download(
    actorUserId: string,
    request: { workspaceId: string; formId: string; fileId: string },
  ) {
    const input = formScopeSchema.extend({ fileId: z.uuid() }).parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "responses:read",
      async (transaction) => {
        await lockedForm(transaction, input.workspaceId, input.formId, "share");
        const [file] = await transaction
          .select({
            objectKey: submissionFilesTable.objectKey,
            name: submissionFilesTable.originalFilename,
            mediaType: submissionFilesTable.mediaType,
          })
          .from(submissionFilesTable)
          .innerJoin(
            formSubmissionsTable,
            and(
              eq(formSubmissionsTable.workspaceId, submissionFilesTable.workspaceId),
              eq(formSubmissionsTable.id, submissionFilesTable.submissionId),
              eq(formSubmissionsTable.versionId, submissionFilesTable.versionId),
            ),
          )
          .where(
            and(
              eq(submissionFilesTable.workspaceId, input.workspaceId),
              eq(submissionFilesTable.id, input.fileId),
              eq(submissionFilesTable.uploadState, "READY"),
              eq(formSubmissionsTable.formId, input.formId),
              eq(formSubmissionsTable.status, "COMPLETED"),
              isNull(formSubmissionsTable.deletedAt),
              sql`(${formSubmissionsTable.expiresAt} IS NULL OR ${formSubmissionsTable.expiresAt}>clock_timestamp())`,
            ),
          )
          .limit(1);
        if (!file) throw new FormError("NOT_FOUND", "This attachment is unavailable.");
        try {
          return {
            name: file.name,
            mediaType: file.mediaType,
            bytes: await this.fileStore.read(file.objectKey),
          };
        } catch {
          throw new FormError("NOT_FOUND", "This attachment is unavailable.");
        }
      },
    );
  }
  async list(actorUserId: string, request: ReturnType<typeof responsesInputSchema.parse>) {
    const input = responsesInputSchema.parse(request);
    let cursor: { time: string; id: string } | undefined;
    if (input.before) {
      const [time, id, ...extra] = input.before.split("|");
      if (
        extra.length ||
        !z.iso.datetime({ offset: true }).safeParse(time).success ||
        !z.uuid().safeParse(id).success
      )
        throw new FormError("INVALID", "Invalid response cursor.");
      cursor = { time: time!, id: id! };
    }
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "responses:read",
      async (transaction) => {
        await lockedForm(transaction, input.workspaceId, input.formId, "share");
        const records = await transaction
          .select({
            id: formSubmissionsTable.id,
            versionId: formSubmissionsTable.versionId,
            completedAt: sql<string>`to_char(${formSubmissionsTable.completedAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            versionNumber: formVersionsTable.versionNumber,
            formTitle: formVersionsTable.title,
          })
          .from(formSubmissionsTable)
          .innerJoin(
            formVersionsTable,
            and(
              eq(formVersionsTable.workspaceId, formSubmissionsTable.workspaceId),
              eq(formVersionsTable.id, formSubmissionsTable.versionId),
            ),
          )
          .where(
            and(
              eq(formSubmissionsTable.workspaceId, input.workspaceId),
              eq(formSubmissionsTable.formId, input.formId),
              eq(formSubmissionsTable.status, "COMPLETED"),
              isNull(formSubmissionsTable.deletedAt),
              sql`(${formSubmissionsTable.expiresAt} IS NULL OR ${formSubmissionsTable.expiresAt}>clock_timestamp())`,
              cursor
                ? sql`(${formSubmissionsTable.completedAt},${formSubmissionsTable.id})<(${cursor.time}::timestamptz,${cursor.id}::uuid)`
                : undefined,
            ),
          )
          .orderBy(desc(formSubmissionsTable.completedAt), desc(formSubmissionsTable.id))
          .limit(input.limit + 1);
        const page = records.slice(0, input.limit);
        if (!page.length) return { items: [], nextCursor: null };
        const ids = page.map((item) => item.id);
        const answers = await transaction
          .select({ answer: submissionAnswersTable, field: formFieldsTable })
          .from(submissionAnswersTable)
          .innerJoin(
            formFieldsTable,
            and(
              eq(formFieldsTable.workspaceId, submissionAnswersTable.workspaceId),
              eq(formFieldsTable.versionId, submissionAnswersTable.versionId),
              eq(formFieldsTable.id, submissionAnswersTable.fieldId),
            ),
          )
          .where(
            and(
              eq(submissionAnswersTable.workspaceId, input.workspaceId),
              inArray(submissionAnswersTable.submissionId, ids),
            ),
          )
          .orderBy(formFieldsTable.position);
        const answerIds = answers.map((item) => item.answer.id);
        const selections = answerIds.length
          ? await transaction
              .select({ answerId: answerSelectionsTable.answerId, label: fieldOptionsTable.label })
              .from(answerSelectionsTable)
              .innerJoin(
                fieldOptionsTable,
                and(
                  eq(fieldOptionsTable.workspaceId, answerSelectionsTable.workspaceId),
                  eq(fieldOptionsTable.versionId, answerSelectionsTable.versionId),
                  eq(fieldOptionsTable.id, answerSelectionsTable.optionId),
                ),
              )
              .where(
                and(
                  eq(answerSelectionsTable.workspaceId, input.workspaceId),
                  inArray(answerSelectionsTable.answerId, answerIds),
                ),
              )
              .orderBy(fieldOptionsTable.position)
          : [];
        const files = answerIds.length
          ? await transaction
              .select({
                answerId: answerFilesTable.answerId,
                id: submissionFilesTable.id,
                name: submissionFilesTable.originalFilename,
              })
              .from(answerFilesTable)
              .innerJoin(
                submissionFilesTable,
                and(
                  eq(submissionFilesTable.workspaceId, answerFilesTable.workspaceId),
                  eq(submissionFilesTable.versionId, answerFilesTable.versionId),
                  eq(submissionFilesTable.id, answerFilesTable.fileId),
                ),
              )
              .where(
                and(
                  eq(answerFilesTable.workspaceId, input.workspaceId),
                  inArray(answerFilesTable.answerId, answerIds),
                ),
              )
          : [];
        const items: ResponseItem[] = page.map((item) => ({
          ...item,
          answers: answers
            .filter((row) => row.answer.submissionId === item.id)
            .map(({ answer, field }) => ({
              fieldKey: field.key,
              label: field.label,
              type: field.typeCode,
              fileIds: files.filter((file) => file.answerId === answer.id).map((file) => file.id),
              text:
                answer.storageKind === "FILE"
                  ? files
                      .filter((file) => file.answerId === answer.id)
                      .map((file) => file.name)
                      .join(", ")
                  : answer.storageKind === "SINGLE_SELECT" || answer.storageKind === "MULTI_SELECT"
                    ? selections
                        .filter((selection) => selection.answerId === answer.id)
                        .map((selection) => selection.label)
                        .join(", ")
                    : (answer.valueText ??
                      answer.valueNumber ??
                      (answer.valueBoolean === null ? null : answer.valueBoolean ? "Yes" : "No") ??
                      answer.valueDate ??
                      answer.valueDatetime?.toISOString() ??
                      JSON.stringify(answer.valueJson)),
            })),
        }));
        const last = items.at(-1)!;
        return {
          items,
          nextCursor: records.length > input.limit ? last.completedAt + "|" + last.id : null,
        };
      },
    );
  }
}
