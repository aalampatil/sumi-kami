import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { withWorkspaceDiscovery } from "@repo/database/discovery";
import { withAuthorizedWorkspace } from "@repo/database/tenant";
import { WorkspaceAccessError } from "../errors";
import { getFixture } from "./fixture";

async function accessFailure(
  operation: () => Promise<unknown>,
  reason: "NOT_FOUND" | "FORBIDDEN" | "SLUG_TAKEN",
) {
  await assert.rejects(
    operation,
    (error) => error instanceof WorkspaceAccessError && error.reason === reason,
  );
}

test("derive workspace owners from the authenticated actor", async () => {
  const f = getFixture();
  const created = await f.createWorkspace(f.users.editor);
  const result = await f.pool.query("SELECT owner_user_id FROM builder.workspaces WHERE id=$1", [
    created.id,
  ]);
  assert.equal(result.rows[0].owner_user_id, f.users.editor);
  assert.equal(created.role, "OWNER");
});

test("attribute workspace creation to the current actor", async () => {
  const f = getFixture();
  const created = await f.createWorkspace();
  const result = await f.pool.query(
    "SELECT actor_user_id FROM builder.workspace_audit_events WHERE workspace_id=$1 AND entity_type='workspaces'",
    [created.id],
  );
  assert.ok(result.rows.length);
  assert.ok(result.rows.every((row) => row.actor_user_id === f.users.owner));
});

test("list owned workspaces without requiring membership rows", async () => {
  const f = getFixture();
  const result = await f.service.list(f.users.stranger, { limit: 50 });
  assert.ok(result.items.some((item) => item.id === f.otherWorkspace.id && item.role === "OWNER"));
});

test("discover joined workspaces without exposing other owners", async () => {
  const f = getFixture();
  const result = await f.service.list(f.users.viewer, { limit: 50 });
  assert.deepEqual(
    result.items.map((item) => item.id),
    [f.workspace.id],
  );
  assert.equal(result.items[0]?.role, "VIEWER");
});

test("hide other workspaces from an unrelated owner", async () => {
  const f = getFixture();
  await accessFailure(() => f.service.get(f.users.owner, f.otherWorkspace.id), "NOT_FOUND");
});

test("prevent global platform admins from bypassing workspace membership", async () => {
  const f = getFixture();
  assert.deepEqual((await f.service.list(f.users.platformAdmin, { limit: 50 })).items, []);
  await accessFailure(() => f.service.get(f.users.platformAdmin, f.workspace.id), "NOT_FOUND");
});

test("grant owner authority despite a lower membership role", async () => {
  const f = getFixture();
  const created = await f.createWorkspace();
  await f.pool.query(
    "INSERT INTO builder.workspace_memberships (workspace_id,user_id,role) VALUES ($1,$2,'VIEWER')",
    [created.id, f.users.owner],
  );
  assert.equal((await f.service.get(f.users.owner, created.id)).role, "OWNER");
  await f.service.update(f.users.owner, {
    workspaceId: created.id,
    name: "Owner edit",
    retentionDays: null,
  });
});

test("permit admins to update workspace settings", async () => {
  const f = getFixture();
  const updated = await f.service.update(f.users.admin, {
    workspaceId: f.workspace.id,
    name: "Admin-managed workspace",
    retentionDays: 30,
  });
  assert.equal(updated.name, "Admin-managed workspace");
  assert.equal(updated.retentionDays, 30);
  assert.equal(updated.role, "ADMIN");
});

test("reject editor settings writes while preserving data", async () => {
  const f = getFixture();
  const before = await f.service.get(f.users.editor, f.workspace.id);
  await accessFailure(
    () =>
      f.service.update(f.users.editor, {
        workspaceId: f.workspace.id,
        name: "Forbidden editor update",
        retentionDays: 1,
      }),
    "FORBIDDEN",
  );
  assert.equal((await f.service.get(f.users.editor, f.workspace.id)).name, before.name);
});

test("reject viewer settings writes while preserving retention", async () => {
  const f = getFixture();
  const before = await f.service.get(f.users.viewer, f.workspace.id);
  await accessFailure(
    () =>
      f.service.update(f.users.viewer, {
        workspaceId: f.workspace.id,
        name: "Forbidden viewer update",
        retentionDays: 1,
      }),
    "FORBIDDEN",
  );
  assert.equal(
    (await f.service.get(f.users.viewer, f.workspace.id)).retentionDays,
    before.retentionDays,
  );
});

test("hide workspace existence from unauthorized updates", async () => {
  const f = getFixture();
  await accessFailure(
    () =>
      f.service.update(f.users.stranger, {
        workspaceId: f.workspace.id,
        name: "Unauthorized",
        retentionDays: null,
      }),
    "NOT_FOUND",
  );
});

test("report missing workspaces without exposing membership state", async () => {
  const f = getFixture();
  await accessFailure(() => f.service.get(f.users.owner, randomUUID()), "NOT_FOUND");
});

test("hide deleted workspaces from discovery", async () => {
  const f = getFixture();
  const created = await f.createWorkspace();
  await f.pool.query("UPDATE builder.workspaces SET deleted_at=now() WHERE id=$1", [created.id]);
  await accessFailure(() => f.service.get(f.users.owner, created.id), "NOT_FOUND");
  assert.ok(
    !(await f.service.list(f.users.owner, { limit: 50 })).items.some(
      (item) => item.id === created.id,
    ),
  );
});

test("deny writes after a workspace is deleted", async () => {
  const f = getFixture();
  const created = await f.createWorkspace();
  await f.pool.query("UPDATE builder.workspaces SET deleted_at=now() WHERE id=$1", [created.id]);
  await accessFailure(
    () =>
      f.service.update(f.users.owner, {
        workspaceId: created.id,
        name: "Deleted",
        retentionDays: null,
      }),
    "NOT_FOUND",
  );
});

test("observe membership revocation on the next request", async () => {
  const f = getFixture();
  const created = await f.createWorkspace();
  await f.pool.query(
    "INSERT INTO builder.workspace_memberships (workspace_id,user_id,role) VALUES ($1,$2,'ADMIN')",
    [created.id, f.users.viewer],
  );
  assert.equal((await f.service.get(f.users.viewer, created.id)).role, "ADMIN");
  await f.pool.query(
    "DELETE FROM builder.workspace_memberships WHERE workspace_id=$1 AND user_id=$2",
    [created.id, f.users.viewer],
  );
  await accessFailure(() => f.service.get(f.users.viewer, created.id), "NOT_FOUND");
});

test("observe downgraded workspace roles on the next write", async () => {
  const f = getFixture();
  const created = await f.createWorkspace();
  await f.pool.query(
    "INSERT INTO builder.workspace_memberships (workspace_id,user_id,role) VALUES ($1,$2,'ADMIN')",
    [created.id, f.users.viewer],
  );
  await f.pool.query(
    "UPDATE builder.workspace_memberships SET role='VIEWER' WHERE workspace_id=$1 AND user_id=$2",
    [created.id, f.users.viewer],
  );
  await accessFailure(
    () =>
      f.service.update(f.users.viewer, {
        workspaceId: created.id,
        name: "Stale admin",
        retentionDays: null,
      }),
    "FORBIDDEN",
  );
});

test("translate duplicate addresses into a stable conflict", async () => {
  const f = getFixture();
  await accessFailure(
    () => f.service.create(f.users.stranger, { name: "Duplicate address", slug: f.workspace.slug }),
    "SLUG_TAKEN",
  );
});

test("serialize concurrent address claims without duplicate workspaces", async () => {
  const f = getFixture();
  const slug = "claim-" + randomUUID();
  const results = await Promise.allSettled([
    f.service.create(f.users.owner, { name: "Claim A", slug }),
    f.service.create(f.users.stranger, { name: "Claim B", slug }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(
    (await f.pool.query("SELECT count(*) FROM builder.workspaces WHERE slug=$1", [slug])).rows[0]
      .count,
    "1",
  );
});

test("keep workspace discovery from reading form definitions", async () => {
  const f = getFixture();
  await withWorkspaceDiscovery(f.database, f.users.owner, async (transaction) => {
    const result = await transaction.execute(sql`SELECT * FROM builder.forms`);
    assert.equal(result.rows.length, 0);
  });
});

test("hide workspace rows when neither context is present", async () => {
  const f = getFixture();
  assert.equal((await f.runtimePool.query("SELECT id FROM builder.workspaces")).rows.length, 0);
  assert.equal(
    (await f.runtimePool.query("SELECT id FROM builder.workspace_memberships")).rows.length,
    0,
  );
});
