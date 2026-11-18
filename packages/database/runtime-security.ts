import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type TenantDatabase = NodePgDatabase;
export type WorkspaceTransaction = Parameters<Parameters<TenantDatabase["transaction"]>[0]>[0];
export function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    throw new Error("Workspace and actor IDs must be UUIDs");
}

export async function assertRuntimeConnection(transaction: WorkspaceTransaction): Promise<void> {
  const identity = await transaction.execute(sql`SELECT r.rolsuper OR r.rolbypassrls
 OR pg_has_role(current_user, 'builder_maintenance', 'MEMBER')
 OR pg_has_role(current_user, (SELECT nspowner FROM pg_namespace WHERE nspname = 'builder'), 'USAGE')
 OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'builder' AND pg_has_role(current_user, c.relowner, 'USAGE')) AS privileged,
 pg_has_role(current_user, 'builder_runtime', 'USAGE') AS runtime
 FROM pg_roles r WHERE rolname = current_user`);
  if (identity.rows[0]?.privileged !== false || identity.rows[0]?.runtime !== true)
    throw new Error("Workspace transactions require a non-owner builder_runtime connection");
}
