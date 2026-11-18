export function tenantConnectionString(environment: { TENANT_DATABASE_URL?: string }): string {
  const value = environment.TENANT_DATABASE_URL?.trim();
  if (!value) throw new Error("Set TENANT_DATABASE_URL to a restricted builder_runtime login.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TENANT_DATABASE_URL must be a PostgreSQL URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    !parsed.username ||
    parsed.pathname.length < 2
  )
    throw new Error("TENANT_DATABASE_URL must identify a PostgreSQL host, login, and database.");
  return value;
}
