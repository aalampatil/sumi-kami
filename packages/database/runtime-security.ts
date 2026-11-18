import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type TenantDatabase = NodePgDatabase;
export type WorkspaceTransaction = Parameters<Parameters<TenantDatabase["transaction"]>[0]>[0];
export function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new Error("Workspace and actor IDs must be UUIDs");
}
