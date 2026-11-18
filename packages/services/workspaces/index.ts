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
  async list(actorUserId: string, request: ListWorkspacesInput): Promise<WorkspacePage> {
    const input = listWorkspacesSchema.parse(request);
    return withWorkspaceDiscovery(this.database(), actorUserId, async (transaction) => {
      const records = await transaction
        .select({ ...workspaceColumns, role: effectiveWorkspaceRole(actorUserId) })
        .from(workspacesTable)
        .leftJoin(
          workspaceMembershipsTable,
          and(
            eq(workspaceMembershipsTable.workspaceId, workspacesTable.id),
            eq(workspaceMembershipsTable.userId, actorUserId),
          ),
        )
        .where(
          and(
            isNull(workspacesTable.deletedAt),
            input.cursorCreatedAt && input.cursorId
              ? sql`(${workspacesTable.createdAt}, ${workspacesTable.id}) < (${input.cursorCreatedAt}::timestamptz, ${input.cursorId}::uuid)`
              : undefined,
          ),
        )
        .orderBy(desc(workspacesTable.createdAt), desc(workspacesTable.id))
        .limit(input.limit + 1);
      const items = records
        .slice(0, input.limit)
        .map((record) => workspaceSummarySchema.parse(record));
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          records.length > input.limit && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    });
  }
  async get(actorUserId: string, workspaceId: string): Promise<WorkspaceSummary> {
    return discoverWorkspace(this.database(), actorUserId, workspaceId);
  }
}
