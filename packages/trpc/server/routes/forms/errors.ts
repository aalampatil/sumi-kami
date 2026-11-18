import { FormError } from "@repo/services/forms/errors";
import { WorkspaceAccessError } from "@repo/services/workspaces/errors";
import { TRPCError } from "../../trpc";
export async function formOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof WorkspaceAccessError)
      throw new TRPCError({
        code: error.reason === "FORBIDDEN" ? "FORBIDDEN" : "NOT_FOUND",
        message:
          error.reason === "FORBIDDEN"
            ? "Your workspace role does not allow this action."
            : "This form is unavailable.",
        cause: error,
      });
    if (error instanceof FormError)
      throw new TRPCError({
        code: error.reason === "INVALID" ? "BAD_REQUEST" : error.reason,
        message: error.message,
        cause: error,
      });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "We couldn’t complete this form request. Please try again.",
      cause: error,
    });
  }
}
