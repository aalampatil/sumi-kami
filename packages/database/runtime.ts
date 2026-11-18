import type { TenantDatabase } from "./runtime-security";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { tenantConnectionString } from "./runtime-config";

let runtime: TenantDatabase | undefined;
let pool: Pool | undefined;
export function getTenantDatabase(): TenantDatabase {
  if (!runtime) {
    pool = new Pool({
      connectionString: tenantConnectionString({
        TENANT_DATABASE_URL: process.env.TENANT_DATABASE_URL,
      }),
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      application_name: "sumikami-tenant",
    });
    runtime = drizzle(pool);
  }
  return runtime;
}
export async function closeTenantDatabase(): Promise<void> {
  const active = pool;
  runtime = undefined;
  pool = undefined;
  await active?.end();
}
