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
}
