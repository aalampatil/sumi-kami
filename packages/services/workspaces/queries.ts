import { sql } from "@repo/database";
import { workspacesTable, workspaceMembershipsTable } from "@repo/database/schema";
import type { WorkspaceRole } from "./model";

export const workspaceColumns = {
  id: workspacesTable.id,
  name: workspacesTable.name,
  slug: workspacesTable.slug,
  retentionDays: workspacesTable.retentionDays,
  createdAt: sql<string>`to_char(${workspacesTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
};

export function effectiveWorkspaceRole(actorUserId: string) {
  return sql<WorkspaceRole>`CASE WHEN ${workspacesTable.ownerUserId} = ${actorUserId}::uuid THEN 'OWNER' ELSE ${workspaceMembershipsTable.role} END`;
}
