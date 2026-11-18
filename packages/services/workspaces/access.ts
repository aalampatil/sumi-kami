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

export async function withWorkspaceAccess<T>(
  database: TenantDatabase,
  actorUserId: string,
  workspaceId: string,
  capability: WorkspaceCapability,
  operation: (transaction: WorkspaceTransaction, role: WorkspaceRole) => Promise<T>,
  lock: "share" | "update" = "share",
): Promise<T> {
  const discovered = await discoverWorkspace(database, actorUserId, workspaceId);
  if (!hasWorkspaceCapability(discovered.role, capability))
    throw new WorkspaceAccessError("FORBIDDEN");
  return withAuthorizedWorkspace(
    database,
    workspaceId,
    async (transaction) => {
      const [workspace] = await transaction
        .select({ ownerUserId: workspacesTable.ownerUserId })
        .from(workspacesTable)
        .where(and(eq(workspacesTable.id, workspaceId), isNull(workspacesTable.deletedAt)))
        .for(lock);
      if (!workspace) throw new WorkspaceAccessError("NOT_FOUND");
      let role: WorkspaceRole;
      if (workspace.ownerUserId === actorUserId) role = "OWNER";
      else {
        const [membership] = await transaction
          .select({ role: workspaceMembershipsTable.role })
          .from(workspaceMembershipsTable)
          .where(
            and(
              eq(workspaceMembershipsTable.workspaceId, workspaceId),
              eq(workspaceMembershipsTable.userId, actorUserId),
            ),
          )
          .for("share");
        if (!membership) throw new WorkspaceAccessError("NOT_FOUND");
        role = membership.role;
      }
      if (!hasWorkspaceCapability(role, capability)) throw new WorkspaceAccessError("FORBIDDEN");
      return operation(transaction, role);
    },
    actorUserId,
  );
}
