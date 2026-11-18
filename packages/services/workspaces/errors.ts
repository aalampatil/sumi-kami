export class WorkspaceAccessError extends Error {
  constructor(public readonly reason: "NOT_FOUND" | "FORBIDDEN" | "SLUG_TAKEN") {
    super(reason);
    this.name = "WorkspaceAccessError";
  }
}

export function postgresError(error: unknown): { code?: string; constraint?: string } | undefined {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string")
      return current as { code: string; constraint?: string };
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
