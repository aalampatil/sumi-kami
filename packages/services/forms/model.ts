import { z } from "zod";
import { definitionSchema, keySchema } from "@repo/form-core/definition";
export const formScopeSchema = z.strictObject({ workspaceId: z.uuid(), formId: z.uuid() });
export const formCreateSchema = z.strictObject({
  workspaceId: z.uuid(),
  title: z.string().trim().min(1).max(200),
});
export const formSaveSchema = formScopeSchema.extend({
  expectedRevision: z.number().int().positive(),
  definition: definitionSchema,
});
export const formPublishSchema = formScopeSchema.extend({
  expectedRevision: z.number().int().positive(),
});
export const formListSchema = z
  .strictObject({
    workspaceId: z.uuid(),
    limit: z.number().int().min(1).max(50).default(20),
    cursorCreatedAt: z.iso.datetime({ offset: true }).optional(),
    cursorId: z.uuid().optional(),
  })
  .refine(
    (input) => Boolean(input.cursorCreatedAt) === Boolean(input.cursorId),
    "Supply both cursor fields.",
  );
export const formListItemSchema = z.strictObject({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  published: z.boolean(),
  hasDraft: z.boolean(),
  archived: z.boolean(),
  responseCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export const formPageSchema = z.strictObject({
  items: z.array(formListItemSchema),
  nextCursor: z.object({ createdAt: z.string(), id: z.uuid() }).nullable(),
});
export const editorSchema = z.strictObject({
  id: z.uuid(),
  slug: z.string(),
  workspaceId: z.uuid(),
  workspaceName: z.string(),
  publishedVersionId: z.uuid().nullable(),
  archived: z.boolean(),
  canEdit: z.boolean(),
  canPublish: z.boolean(),
  canExport: z.boolean(),
  versionId: z.uuid(),
  versionNumber: z.number().int(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  revision: z.number().int(),
  definition: definitionSchema,
});
export type FormEditor = z.infer<typeof editorSchema>;
export type FormListItem = z.infer<typeof formListItemSchema>;
export type SaveFormInput = z.infer<typeof formSaveSchema>;
export const publicSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const publicFormSchema = z.strictObject({
  slug: publicSlugSchema,
  versionId: z.uuid(),
  definition: definitionSchema,
});
export type PublishedForm = z.infer<typeof publicFormSchema>;
export const answerInputSchema = z.strictObject({
  fieldKey: keySchema,
  value: z.union([z.string().max(20000), z.boolean(), z.array(z.string().max(200)).max(100)]),
});
export const submitFormSchema = z.strictObject({
  slug: publicSlugSchema,
  versionId: z.uuid(),
  idempotencyKey: z.uuid(),
  answers: z.array(answerInputSchema).max(200),
});
export type SubmitFormInput = z.infer<typeof submitFormSchema>;
export const receiptSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  message: z.string(),
  completedAt: z.string(),
});
export const responsesInputSchema = formScopeSchema.extend({
  limit: z.number().int().min(1).max(50).default(20),
  before: z.string().max(100).optional(),
});
export const responseItemSchema = z.strictObject({
  id: z.uuid(),
  versionId: z.uuid(),
  completedAt: z.string(),
  versionNumber: z.number().int(),
  formTitle: z.string(),
  answers: z.array(
    z.strictObject({
      fieldKey: z.string(),
      label: z.string(),
      type: z.string(),
      text: z.string(),
      fileIds: z.array(z.uuid()).default([]),
    }),
  ),
});
export const responsePageSchema = z.strictObject({
  items: z.array(responseItemSchema),
  nextCursor: z.string().nullable(),
});
export type ResponseItem = z.infer<typeof responseItemSchema>;
export const archiveFormSchema = formScopeSchema.extend({ archived: z.boolean() });
export const exportPageSchema = z.strictObject({ csv: z.string(), filename: z.string() });
export const responseSummarySchema = z.strictObject({
  total: z.number().int().nonnegative(),
  recent: z.number().int().nonnegative(),
  daily: z.array(z.strictObject({ date: z.string(), count: z.number().int().nonnegative() })),
  versions: z.array(
    z.strictObject({
      versionNumber: z.number().int(),
      title: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
