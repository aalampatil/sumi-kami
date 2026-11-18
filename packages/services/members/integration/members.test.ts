import assert from "node:assert/strict";
import { test } from "node:test";
import { getFixture } from "../../workspaces/integration/fixture";
import { FormError } from "../../forms/errors";
import { WorkspaceAccessError } from "../../workspaces/errors";
async function service(verified = true) {
  const f = getFixture();
  return new (await import("../index")).MemberService(
    () => f.database,
    async (id) => (verified ? id + "@example.invalid" : null),
  );
}
test("owners invite a verified recipient and concurrent acceptance creates one membership", async () => {
  const f = getFixture(),
    members = await service(),
    workspace = await f.createWorkspace(),
    email = f.users.stranger + "@example.invalid";
  const invite = await members.invite(f.users.owner, {
    workspaceId: workspace.id,
    email,
    role: "EDITOR",
  });
  const rows = await f.pool.query(
    "SELECT token_hash FROM builder.workspace_invitations WHERE workspace_id=$1",
    [workspace.id],
  );
  assert.notEqual(rows.rows[0].token_hash, invite.token);
  const accepted = await Promise.all(
    Array.from({ length: 3 }, () => members.accept(f.users.stranger, invite)),
  );
  assert.ok(accepted.every((result) => result.workspaceId === workspace.id));
  assert.equal((await f.service.get(f.users.stranger, workspace.id)).role, "EDITOR");
  assert.equal(
    (
      await f.pool.query(
        "SELECT count(*) FROM builder.workspace_memberships WHERE workspace_id=$1 AND user_id=$2",
        [workspace.id, f.users.stranger],
      )
    ).rows[0].count,
    "1",
  );
});
test("wrong or unverified emails cannot use an invitation", async () => {
  const f = getFixture(),
    members = await service(),
    workspace = await f.createWorkspace(),
    invite = await members.invite(f.users.owner, {
      workspaceId: workspace.id,
      email: f.users.stranger + "@example.invalid",
      role: "VIEWER",
    });
  await assert.rejects(
    () => members.accept(f.users.viewer, invite),
    (error) => error instanceof FormError && error.reason === "FORBIDDEN",
  );
  const unverified = await service(false);
  await assert.rejects(
    () => unverified.accept(f.users.stranger, invite),
    (error) => error instanceof FormError && error.reason === "FORBIDDEN",
  );
});
test("revoked and expired invitations cannot grant membership", async () => {
  const f = getFixture(),
    members = await service(),
    workspace = await f.createWorkspace(),
    invite = await members.invite(f.users.owner, {
      workspaceId: workspace.id,
      email: f.users.stranger + "@example.invalid",
      role: "VIEWER",
    });
  const team = await members.list(f.users.owner, { workspaceId: workspace.id });
  await members.revoke(f.users.owner, {
    workspaceId: workspace.id,
    invitationId: team.invitations[0]!.id,
  });
  await assert.rejects(
    () => members.accept(f.users.stranger, invite),
    (error) => error instanceof FormError && error.reason === "NOT_FOUND",
  );
  const expired = await members.invite(f.users.owner, {
    workspaceId: workspace.id,
    email: f.users.stranger + "@example.invalid",
    role: "VIEWER",
  });
  await f.pool.query(
    "UPDATE builder.workspace_invitations SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE workspace_id=$1 AND revoked_at IS NULL",
    [workspace.id],
  );
  await assert.rejects(
    () => members.accept(f.users.stranger, expired),
    (error) => error instanceof FormError && error.reason === "NOT_FOUND",
  );
});
test("role changes take effect, owners stay protected, and removed members cannot reuse accepted links", async () => {
  const f = getFixture(),
    members = await service(),
    workspace = await f.createWorkspace(),
    invite = await members.invite(f.users.owner, {
      workspaceId: workspace.id,
      email: f.users.stranger + "@example.invalid",
      role: "EDITOR",
    });
  await members.accept(f.users.stranger, invite);
  await members.update(f.users.owner, {
    workspaceId: workspace.id,
    userId: f.users.stranger,
    role: "VIEWER",
  });
  assert.equal((await f.service.get(f.users.stranger, workspace.id)).role, "VIEWER");
  await assert.rejects(
    () =>
      members.invite(f.users.stranger, {
        workspaceId: workspace.id,
        email: f.users.editor + "@example.invalid",
        role: "ADMIN",
      }),
    (error) => error instanceof WorkspaceAccessError && error.reason === "FORBIDDEN",
  );
  await assert.rejects(
    () => members.remove(f.users.owner, { workspaceId: workspace.id, userId: f.users.owner }),
    (error) => error instanceof FormError && error.reason === "FORBIDDEN",
  );
  await members.remove(f.users.owner, { workspaceId: workspace.id, userId: f.users.stranger });
  await assert.rejects(
    () => members.accept(f.users.stranger, invite),
    (error) => error instanceof FormError && error.reason === "NOT_FOUND",
  );
});
test("members cannot discover another workspace’s invitations and RLS rejects unscoped writes", async () => {
  const f = getFixture(),
    members = await service(),
    workspace = await f.createWorkspace();
  await members.invite(f.users.owner, {
    workspaceId: workspace.id,
    email: f.users.stranger + "@example.invalid",
    role: "VIEWER",
  });
  await assert.rejects(
    () => members.list(f.users.stranger, { workspaceId: workspace.id }),
    (error) => error instanceof WorkspaceAccessError && error.reason === "NOT_FOUND",
  );
  assert.equal(
    (await f.runtimePool.query("SELECT count(*) FROM builder.workspace_invitations")).rows[0].count,
    "0",
  );
  await assert.rejects(() =>
    f.runtimePool.query(
      "INSERT INTO builder.workspace_invitations (workspace_id,email,role,token_hash,expires_at) VALUES ($1,$2,'ADMIN',repeat('a',64),now()+interval '1 day')",
      [workspace.id, "intruder@example.invalid"],
    ),
  );
});
