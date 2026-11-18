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
