import { randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  isNull,
  sql,
  withAuthorizedWorkspace,
  withWorkspaceDiscovery,
  type TenantDatabase,
} from "@repo/database";
import { getTenantDatabase } from "@repo/database/runtime";
import { workspacesTable, workspaceMembershipsTable } from "@repo/database/schema";
import { discoverWorkspace, withWorkspaceAccess } from "./access";
import { postgresError, WorkspaceAccessError } from "./errors";
import {
  createWorkspaceSchema,
  listWorkspacesSchema,
  updateWorkspaceSchema,
  workspaceSummarySchema,
  type CreateWorkspaceInput,
  type ListWorkspacesInput,
  type UpdateWorkspaceInput,
  type WorkspacePage,
  type WorkspaceSummary,
} from "./model";
import { effectiveWorkspaceRole, workspaceColumns } from "./queries";

export class WorkspaceService {
  constructor(private readonly database: () => TenantDatabase = getTenantDatabase) {}
  async create(actorUserId: string, request: CreateWorkspaceInput): Promise<WorkspaceSummary> {
    const input = createWorkspaceSchema.parse(request);
    const id = randomUUID();
    try {
      return await withAuthorizedWorkspace(
        this.database(),
        id,
        async (transaction) => {
          const [workspace] = await transaction
            .insert(workspacesTable)
            .values({ id, ownerUserId: actorUserId, name: input.name, slug: input.slug })
            .returning(workspaceColumns);
          return workspaceSummarySchema.parse({ ...workspace, role: "OWNER" });
        },
        actorUserId,
      );
    } catch (error) {
      const databaseError = postgresError(error);
      if (databaseError?.code === "23505" && databaseError.constraint === "workspaces_slug_unique")
        throw new WorkspaceAccessError("SLUG_TAKEN");
      throw error;
    }
  }
}
