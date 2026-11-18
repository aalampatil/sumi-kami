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

export const workspacesRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: "/workspaces", tags: ["Workspaces"], protect: true } })
    .input(listWorkspacesSchema)
    .output(workspacePageSchema)
    .query(({ ctx, input }) => workspaceOperation(() => workspaceService.list(ctx.user.id, input))),
  create: protectedProcedure
    .meta({ openapi: { method: "POST", path: "/workspaces", tags: ["Workspaces"], protect: true } })
    .input(createWorkspaceSchema)
    .output(workspaceSummarySchema)
    .mutation(({ ctx, input }) =>
      workspaceOperation(() => workspaceService.create(ctx.user.id, input)),
    ),
  get: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/workspaces/{workspaceId}",
        tags: ["Workspaces"],
        protect: true,
      },
    })
    .input(workspaceIdSchema)
    .output(workspaceSummarySchema)
    .query(({ ctx, input }) =>
      workspaceOperation(() => workspaceService.get(ctx.user.id, input.workspaceId)),
    ),
});
