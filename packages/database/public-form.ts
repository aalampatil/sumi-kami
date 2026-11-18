import { sql } from "drizzle-orm";
import {
  assertRuntimeConnection,
  type TenantDatabase,
  type WorkspaceTransaction,
} from "./runtime-security";

/** Resolve a public slug only. The caller must check workspace/intake state before exposing a definition. */
export async function withPublicFormLookup<T>(
  database: TenantDatabase,
  slug: string,
  operation: (transaction: WorkspaceTransaction) => Promise<T>,
): Promise<T> {
  if (slug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new Error("Invalid form slug");
  return database.transaction(async (transaction) => {
    await assertRuntimeConnection(transaction);
    await transaction.execute(sql`SELECT set_config('app.workspace_id', '', true)`);
    await transaction.execute(sql`SELECT set_config('app.actor_user_id', '', true)`);
    await transaction.execute(sql`SELECT set_config('app.public_form_slug', ${slug}, true)`);
    return operation(transaction);
  });
}
