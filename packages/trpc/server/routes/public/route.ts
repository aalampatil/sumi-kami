import { z } from "zod";
import {
  publicFormSchema,
  publicSlugSchema,
  receiptSchema,
  submitFormSchema,
} from "@repo/services/forms/model";
import { publicProcedure, router, TRPCError } from "../../trpc";
import { publicFormService } from "../../services";
import { formOperation } from "../forms/errors";
import { enforceRateLimit } from "../../utils/rate-limit";

const intakeProcedure = publicProcedure.use(({ ctx, next }) => {
  const key = "public-intake:" + (ctx.req.ip ?? ctx.req.socket.remoteAddress ?? "unknown");
  if (!enforceRateLimit({ key, limit: 120, windowMs: 60000 }).ok)
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Please wait a moment before trying again.",
    });
  return next();
});
export const publicRouter = router({
  form: intakeProcedure
    .meta({ openapi: { method: "GET", path: "/forms/{slug}", tags: ["Public forms"] } })
    .input(z.strictObject({ slug: publicSlugSchema }))
    .output(publicFormSchema)
    .query(({ input }) => formOperation(() => publicFormService.get(input.slug))),
  submit: intakeProcedure
    .meta({
      openapi: { method: "POST", path: "/forms/{slug}/submissions", tags: ["Public forms"] },
    })
    .input(submitFormSchema)
    .output(receiptSchema)
    .mutation(({ input }) => formOperation(() => publicFormService.submit(input))),
});
