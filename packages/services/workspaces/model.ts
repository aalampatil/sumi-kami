import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
