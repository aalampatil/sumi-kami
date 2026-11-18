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

const ownerCapabilities: readonly WorkspaceCapability[] = workspaceCapabilities;

const adminCapabilities: readonly WorkspaceCapability[] = workspaceCapabilities;

const editorCapabilities: readonly WorkspaceCapability[] = [
  "workspace:read",
  "forms:read",
  "forms:edit",
  "forms:publish",
  "responses:read",
  "responses:export",
];

const viewerCapabilities: readonly WorkspaceCapability[] = [
  "workspace:read",
  "forms:read",
  "responses:read",
];

const capabilities: Record<WorkspaceRole, readonly WorkspaceCapability[]> = {
  OWNER: ownerCapabilities,
  ADMIN: adminCapabilities,
  EDITOR: editorCapabilities,
  VIEWER: viewerCapabilities,
};
export function hasWorkspaceCapability(
  role: WorkspaceRole,
  capability: WorkspaceCapability,
): boolean {
  return capabilities[role]?.includes(capability) ?? false;
}
