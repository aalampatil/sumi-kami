import { sql } from "drizzle-orm";
import {
  assertRuntimeConnection,
  assertUuid,
  type TenantDatabase,
  type WorkspaceTransaction,
} from "./runtime-security";

/** Actor must come from the verified local identity, never a request-supplied user ID. */
export async function withWorkspaceDiscovery<T>(
  database: TenantDatabase,
  actorUserId: string,
  operation: (transaction: WorkspaceTransaction) => Promise<T>,
): Promise<T> {
  assertUuid(actorUserId);
  return database.transaction(async (transaction) => {
    await assertRuntimeConnection(transaction);
    await transaction.execute(sql`SELECT set_config('app.workspace_id', '', true)`);
    await transaction.execute(sql`SELECT set_config('app.actor_user_id', ${actorUserId}, true)`);
    return operation(transaction);
  });
}
