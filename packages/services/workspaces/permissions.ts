import type { WorkspaceRole } from "./model";

export const workspaceCapabilities = [
  "workspace:read",
  "workspace:update",
  "members:manage",
  "forms:read",
  "forms:edit",
  "forms:publish",
  "responses:read",
  "responses:export",
] as const;
export type WorkspaceCapability = (typeof workspaceCapabilities)[number];
