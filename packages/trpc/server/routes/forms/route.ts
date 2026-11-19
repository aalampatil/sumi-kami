import { z } from "zod";
import {
  archiveFormSchema,
  editorSchema,
  formCreateSchema,
  formListSchema,
  formPageSchema,
  formPublishSchema,
  formSaveSchema,
  formScopeSchema,
  responsePageSchema,
  responsesInputSchema,
  exportPageSchema,
  responseSummarySchema,
} from "@repo/services/forms/model";
import { FormReportingService } from "@repo/services/forms/reporting";
import { formService, responseService } from "../../services";
import { protectedProcedure, router } from "../../trpc";
import { formOperation } from "./errors";
const base = "/workspaces/{workspaceId}/forms";
const formRoute = (suffix: string): `/${string}` => `${base}${suffix}`;
export const formsRouter = router({
  exportPage: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: formRoute("/{formId}/responses/export"),
        tags: ["Responses"],
        protect: true,
      },
    })
    .input(responsesInputSchema)
    .output(exportPageSchema)
    .query(({ ctx, input }) => formOperation(() => responseService.exportPage(ctx.user.id, input))),
  summary: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: formRoute("/{formId}/responses/summary"),
        tags: ["Responses"],
        protect: true,
      },
    })
    .input(formScopeSchema)
    .output(responseSummarySchema)
    .query(({ ctx, input }) =>
      formOperation(() => new FormReportingService().summary(ctx.user.id, input)),
    ),
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: base, tags: ["Forms"], protect: true } })
    .input(formListSchema)
    .output(formPageSchema)
    .query(({ ctx, input }) => formOperation(() => formService.list(ctx.user.id, input))),
  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: base, tags: ["Forms"], protect: true } })
    .input(formCreateSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.create(ctx.user.id, input))),
  get: protectedProcedure
    .meta({
      openapi: { method: "GET", path: formRoute("/{formId}"), tags: ["Forms"], protect: true },
    })
    .input(formScopeSchema)
    .output(editorSchema)
    .query(({ ctx, input }) => formOperation(() => formService.get(ctx.user.id, input))),
  save: protectedProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: formRoute("/{formId}/draft"),
        tags: ["Forms"],
        protect: true,
      },
    })
    .input(formSaveSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.save(ctx.user.id, input))),
  edit: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: formRoute("/{formId}/draft"),
        tags: ["Forms"],
        protect: true,
      },
    })
    .input(formScopeSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.edit(ctx.user.id, input))),
  publish: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: formRoute("/{formId}/publish"),
        tags: ["Forms"],
        protect: true,
      },
    })
    .input(formPublishSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.publish(ctx.user.id, input))),
  unpublish: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: formRoute("/{formId}/unpublish"),
        tags: ["Forms"],
        protect: true,
      },
    })
    .input(formScopeSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.unpublish(ctx.user.id, input))),
  archive: protectedProcedure
    .meta({
      openapi: {
        method: "PATCH",
        path: formRoute("/{formId}/archive"),
        tags: ["Forms"],
        protect: true,
      },
    })
    .input(archiveFormSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.archive(ctx.user.id, input))),
  duplicate: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: formRoute("/{formId}/duplicate"),
        tags: ["Forms"],
        protect: true,
      },
    })
    .input(formScopeSchema)
    .output(editorSchema)
    .mutation(({ ctx, input }) => formOperation(() => formService.duplicate(ctx.user.id, input))),
  remove: protectedProcedure
    .meta({
      openapi: { method: "DELETE", path: formRoute("/{formId}"), tags: ["Forms"], protect: true },
    })
    .input(formScopeSchema)
    .output(z.strictObject({ success: z.literal(true) }))
    .mutation(({ ctx, input }) => formOperation(() => formService.remove(ctx.user.id, input))),
  responses: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: formRoute("/{formId}/responses"),
        tags: ["Responses"],
        protect: true,
      },
    })
    .input(responsesInputSchema)
    .output(responsePageSchema)
    .query(({ ctx, input }) => formOperation(() => responseService.list(ctx.user.id, input))),
});
