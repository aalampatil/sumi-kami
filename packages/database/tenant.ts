import { sql } from "drizzle-orm";
import {
  assertRuntimeConnection,
  assertUuid,
  type TenantDatabase,
  type WorkspaceTransaction,
} from "./runtime-security";
export type { WorkspaceTransaction } from "./runtime-security";

/** Authenticate and authorize the actor first. RLS isolates scope; it does not grant membership. */
export async function withAuthorizedWorkspace<T>(
  database: TenantDatabase,
  workspaceId: string,
  operation: (transaction: WorkspaceTransaction) => Promise<T>,
  actorUserId?: string,
): Promise<T> {
  assertUuid(workspaceId);
  if (actorUserId !== undefined) assertUuid(actorUserId);
  return database.transaction(async (transaction) => {
    await assertRuntimeConnection(transaction);
    await transaction.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`);
    await transaction.execute(
      sql`SELECT set_config('app.actor_user_id', ${actorUserId ?? ""}, true)`,
    );
    return operation(transaction);
  });
}
