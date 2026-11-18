import { WorkspaceAccessError } from "@repo/services/workspaces/errors";
import { TRPCError } from "../../trpc";

export async function workspaceOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof WorkspaceAccessError) {
      if (error.reason === "NOT_FOUND")
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found.", cause: error });
      if (error.reason === "FORBIDDEN")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your workspace role does not allow this action.",
          cause: error,
        });
      throw new TRPCError({
        code: "CONFLICT",
        message: "That workspace address is already in use.",
        cause: error,
      });
    }
    throw error;
  }
}
