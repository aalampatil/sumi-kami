import { sql } from "drizzle-orm";
import {
  assertRuntimeConnection,
  type TenantDatabase,
  type WorkspaceTransaction,
} from "./runtime-security";
export async function withInvitationLookup<T>(
  database: TenantDatabase,
  hash: string,
  operation: (transaction: WorkspaceTransaction) => Promise<T>,
): Promise<T> {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid invitation hash.");
  return database.transaction(async (transaction) => {
    await assertRuntimeConnection(transaction);
    await transaction.execute(
      sql`SELECT set_config('app.workspace_id','',true),set_config('app.actor_user_id','',true),set_config('app.invitation_hash',${hash},true)`,
    );
    return operation(transaction);
  });
}
