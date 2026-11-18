export class WorkspaceAccessError extends Error {
  constructor(public readonly reason: "NOT_FOUND" | "FORBIDDEN" | "SLUG_TAKEN") {
    super(reason);
    this.name = "WorkspaceAccessError";
  }
}
