import {
  and,
  eq,
  isNull,
  withAuthorizedWorkspace,
  withWorkspaceDiscovery,
  type TenantDatabase,
  type WorkspaceTransaction,
} from "@repo/database";
import { workspacesTable, workspaceMembershipsTable } from "@repo/database/schema";
import { WorkspaceAccessError } from "./errors";
import {
  workspaceIdSchema,
  workspaceSummarySchema,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "./model";
import { hasWorkspaceCapability, type WorkspaceCapability } from "./permissions";
import { effectiveWorkspaceRole, workspaceColumns } from "./queries";

export async function discoverWorkspace(
  database: TenantDatabase,
  actorUserId: string,
  workspaceId: string,
): Promise<WorkspaceSummary> {
  workspaceIdSchema.parse({ workspaceId });
  return withWorkspaceDiscovery(database, actorUserId, async (transaction) => {
    const [workspace] = await transaction
      .select({ ...workspaceColumns, role: effectiveWorkspaceRole(actorUserId) })
      .from(workspacesTable)
      .leftJoin(
        workspaceMembershipsTable,
        and(
          eq(workspaceMembershipsTable.workspaceId, workspacesTable.id),
          eq(workspaceMembershipsTable.userId, actorUserId),
        ),
      )
      .where(and(eq(workspacesTable.id, workspaceId), isNull(workspacesTable.deletedAt)))
      .limit(1);
    if (!workspace) throw new WorkspaceAccessError("NOT_FOUND");
    return workspaceSummarySchema.parse(workspace);
  });
}
