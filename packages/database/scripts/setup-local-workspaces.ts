import { randomBytes, createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { localDevelopmentDatabase } from "../local-development";
import { withWorkspaceDiscovery } from "../discovery";

async function main() {
  const environmentPath = path.resolve(__dirname, "../../../apps/api/.env.local");
  const original = await readFile(environmentPath, "utf8");
  const target = localDevelopmentDatabase(parse(original).DATABASE_URL);
  const admin = new Pool({ connectionString: target.toString(), max: 1 });
  let runtime: Pool | undefined;
  try {
    await migrate(drizzle(admin), { migrationsFolder: path.resolve(__dirname, "../drizzle") });
    const role =
      "sumikami_runtime_" + createHash("sha256").update(target.pathname).digest("hex").slice(0, 12);
    const password = randomBytes(32).toString("hex");
    const existing = await admin.query(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=$1",
      [role],
    );
    if (existing.rows[0]?.rolsuper || existing.rows[0]?.rolbypassrls)
      throw new Error("The local runtime role is unexpectedly privileged.");
    // Identifier and credential contain only a fixed prefix and generated hexadecimal characters.
    if (!existing.rowCount) await admin.query('CREATE ROLE "' + role + '" LOGIN');
    await admin.query(
      'ALTER ROLE "' +
        role +
        '" WITH INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ' +
        "'" +
        password +
        "'",
    );
    await admin.query('GRANT builder_runtime TO "' + role + '"');
    const runtimeUrl = new URL(target);
    runtimeUrl.username = role;
    runtimeUrl.password = password;
    runtime = new Pool({ connectionString: runtimeUrl.toString(), max: 1 });
    await withWorkspaceDiscovery(drizzle(runtime), randomUUID(), async () => undefined);
    const setting = "TENANT_DATABASE_URL=" + runtimeUrl.toString();
    const next = /^TENANT_DATABASE_URL=.*$/m.test(original)
      ? original.replace(/^TENANT_DATABASE_URL=.*$/m, setting)
      : original.trimEnd() + "\n" + setting + "\n";
    await writeFile(environmentPath, next);
    console.log(
      "Local workspace migration and restricted runtime connection are ready. No credentials were printed.",
    );
  } finally {
    await runtime?.end();
    await admin.end();
  }
}
main().catch(() => {
  console.error(
    "Local workspace setup failed. Check the loopback database, migration privileges, and API environment file.",
  );
  process.exitCode = 1;
});
