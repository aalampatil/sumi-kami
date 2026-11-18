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
