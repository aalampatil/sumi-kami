import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { before, after } from "node:test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { WorkspaceService } from "../index";
import type { WorkspaceSummary } from "../model";

type Database = ReturnType<typeof drizzle<Record<string, never>>>;
type Fixture = {
  pool: Pool;
  runtimePool: Pool;
  database: Database;
  service: WorkspaceService;
  users: Record<"owner" | "admin" | "editor" | "viewer" | "stranger" | "platformAdmin", string>;
  workspace: WorkspaceSummary;
  otherWorkspace: WorkspaceSummary;
  createWorkspace: (actor?: string) => Promise<WorkspaceSummary>;
};
let fixture: Fixture;
let admin: Pool | undefined;
let pool: Pool | undefined;
let runtimePool: Pool | undefined;
let name: string | undefined;
let role: string | undefined;
let identityPool: Pool | undefined;
export function getFixture(): Fixture {
  assert.ok(fixture, "Integration fixture must be initialized");
  return fixture;
}

before(async () => {
  const target = process.env.TEST_DATABASE_URL;
  if (!target)
    throw new Error("Set TEST_DATABASE_URL to a disposable loopback database ending in _test.");
  const url = new URL(target);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw new Error("Workspace tests require a disposable loopback PostgreSQL _test database.");
  admin = new Pool({ connectionString: url.toString(), max: 2 });
  const suffix = randomUUID().replaceAll("-", "");
  name = "workspace_" + suffix + "_test";
  role = "workspace_runtime_" + suffix;
  await admin.query('CREATE DATABASE "' + name + '"');
  url.pathname = "/" + name;
  pool = new Pool({ connectionString: url.toString(), max: 5 });
  await migrate(drizzle(pool), {
    migrationsFolder: path.resolve(__dirname, "../../../database/drizzle"),
  });
  const password = randomBytes(24).toString("hex");
  await admin.query(
    'CREATE ROLE "' +
      role +
      '" LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ' +
      "'" +
      password +
      "'",
  );
  await admin.query('GRANT builder_runtime TO "' + role + '"');
  process.env.DATABASE_URL = url.toString();
  const { WorkspaceService } = await import("../index");
  const { db } = await import("@repo/database");
  identityPool = db.$client;
  url.username = role;
  url.password = password;
  runtimePool = new Pool({ connectionString: url.toString(), max: 5 });
  const database = drizzle(runtimePool);
  const service = new WorkspaceService(() => database);
  const users = {
    owner: randomUUID(),
    admin: randomUUID(),
    editor: randomUUID(),
    viewer: randomUUID(),
    stranger: randomUUID(),
    platformAdmin: randomUUID(),
  };
  for (const [key, id] of Object.entries(users))
    await pool.query("INSERT INTO public.users (id,full_name,email,role) VALUES ($1,$2,$3,$4)", [
      id,
      key,
      id + "@example.invalid",
      key === "platformAdmin" ? "ADMIN" : "CREATOR",
    ]);
  const createWorkspace = (actor = users.owner) =>
    service.create(actor, { name: "Integration workspace", slug: "w-" + randomUUID() });
  const workspace = await createWorkspace();
  const otherWorkspace = await createWorkspace(users.stranger);
  for (const membership of ["admin", "editor", "viewer"] as const)
    await pool.query(
      "INSERT INTO builder.workspace_memberships (workspace_id,user_id,role) VALUES ($1,$2,$3)",
      [workspace.id, users[membership], membership.toUpperCase()],
    );
  fixture = {
    pool,
    runtimePool,
    database,
    service,
    users,
    workspace,
    otherWorkspace,
    createWorkspace,
  };
});
after(async () => {
  await identityPool?.end();
  await runtimePool?.end();
  await pool?.end();
  if (admin) {
    if (name) await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
    if (role) await admin.query('DROP ROLE IF EXISTS "' + role + '"');
    await admin.end();
  }
});
