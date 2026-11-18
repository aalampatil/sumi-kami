import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a workspace name.")
  .max(160, "Use 160 characters or fewer.");

export const workspaceSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const workspaceRetentionSchema = z.number().int().min(1).max(99999).nullable();

export const createWorkspaceSchema = z.strictObject({
  name: workspaceNameSchema,
  slug: workspaceSlugSchema,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
