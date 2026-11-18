import {
  createWorkspaceSchema,
  listWorkspacesSchema,
  updateWorkspaceSchema,
  workspaceIdSchema,
  workspacePageSchema,
  workspaceSummarySchema,
} from "@repo/services/workspaces/model";
import { protectedProcedure, router } from "../../trpc";
import { workspaceService } from "../../services";
import { workspaceOperation } from "./errors";

export const workspacesRouter = router({});
