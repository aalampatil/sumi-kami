import { Router, type Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { PublicFormService } from "@repo/services/forms/public";
import { ResponseService } from "@repo/services/forms/responses";
import { FormError } from "@repo/services/forms/errors";
import { WorkspaceAccessError } from "@repo/services/workspaces/errors";
import { submitFormSchema } from "@repo/services/forms/model";
import { createContext } from "@repo/trpc/server";
import { enforceRateLimit } from "@repo/trpc/server/utils/rate-limit";

function reportError(response: Response, error: unknown) {
  const reason =
    error instanceof FormError || error instanceof WorkspaceAccessError ? error.reason : undefined;
  const status =
    reason === "NOT_FOUND"
      ? 404
      : reason === "FORBIDDEN"
        ? 403
        : reason === "CONFLICT"
          ? 409
          : reason === "INVALID" || error instanceof ZodError || error instanceof SyntaxError
            ? 400
            : 500;
  response.status(status).json({
    error:
      error instanceof FormError || error instanceof WorkspaceAccessError
        ? error.message
        : status === 400
          ? "Check the form data and try again."
          : "We couldn’t complete this request. Please try again.",
  });
}

export function formFileRoutes() {
  const router = Router(),
    publicForms = new PublicFormService(),
    responses = new ResponseService();
  const multipart = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 5,
      fileSize: 10 * 1024 * 1024,
      fields: 1,
      fieldSize: 1024 * 1024,
      parts: 6,
      fieldNameSize: 100,
    },
    fileFilter: (_req, file, done) => {
      if (!/^file:[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(file.fieldname))
        done(new Error("Invalid file field"));
      else done(null, true);
    },
  }).any();
  let active = 0;
  router.post("/api/forms/:slug/submissions", (req, res, next) => {
    if (!req.is("multipart/form-data")) {
      next();
      return;
    }
    if (
      !enforceRateLimit({
        key: "public-upload:" + (req.ip ?? "unknown"),
        limit: 15,
        windowMs: 60000,
      }).ok ||
      active >= 4
    ) {
      res
        .status(429)
        .set("Retry-After", "60")
        .json({ error: "Please wait a moment before uploading again." });
      return;
    }
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        active--;
        released = true;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    multipart(req, res, async (error) => {
      if (error) {
        res
          .status(400)
          .json({ error: "Use at most five files, 10 MB per file, and one form data field." });
        return;
      }
      try {
        if (typeof req.body?.data !== "string") throw new SyntaxError();
        const input = submitFormSchema.parse(JSON.parse(req.body.data));
        if (input.slug !== req.params.slug) throw new SyntaxError();
        const files = Array.isArray(req.files) ? req.files : [];
        const receipt = await publicForms.submit(
          input,
          files.map((file) => ({
            fieldKey: file.fieldname.slice(5),
            name: file.originalname,
            bytes: file.buffer,
          })),
        );
        res.status(200).set("Cache-Control", "no-store").json(receipt);
      } catch (error) {
        reportError(res, error);
      }
    });
  });
  router.get("/api/workspaces/:workspaceId/forms/:formId/files/:fileId", async (req, res) => {
    try {
      const context = await createContext({ req, res });
      if (!context.user) {
        res.status(401).json({ error: "Sign in to download attachments." });
        return;
      }
      const file = await responses.download(context.user.id, {
        workspaceId: req.params.workspaceId,
        formId: req.params.formId,
        fileId: req.params.fileId,
      });
      res
        .set({
          "Content-Type": file.mediaType,
          "Content-Disposition":
            "attachment; filename=attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        })
        .send(file.bytes);
    } catch (error) {
      reportError(res, error);
    }
  });
  return router;
}
