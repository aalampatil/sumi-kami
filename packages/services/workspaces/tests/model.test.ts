import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdSchema,
  listWorkspacesSchema,
  workspaceSummarySchema,
} from "../model";
const id = "6ac1ed7e-bda0-4bd5-8e53-37610e610bcc";
const create = { name: "Design studio", slug: "design-studio" };
const update = { workspaceId: id, name: "Design studio", retentionDays: null };
const summary = {
  id,
  ...create,
  role: "OWNER",
  retentionDays: null,
  createdAt: "2026-11-18T12:00:00.123456Z",
};

test("workspace creation trims display names without changing the chosen address", () => {
  assert.deepEqual(createWorkspaceSchema.parse({ ...create, name: "  墨 Design studio  " }), {
    ...create,
    name: "墨 Design studio",
  });
});

test("creation rejects impersonating another owner", () => {
  assert.equal(createWorkspaceSchema.safeParse({ ...create, ownerUserId: id }).success, false);
});

test("creation rejects choosing the server-owned workspace identifier", () => {
  assert.equal(createWorkspaceSchema.safeParse({ ...create, id: id }).success, false);
});

test("creation rejects assigning an elevated workspace role", () => {
  assert.equal(createWorkspaceSchema.safeParse({ ...create, role: "ADMIN" }).success, false);
});

test("creation rejects injecting team memberships", () => {
  assert.equal(
    createWorkspaceSchema.safeParse({ ...create, memberships: [{ userId: id, role: "ADMIN" }] })
      .success,
    false,
  );
});

test("creation rejects forging the audit actor", () => {
  assert.equal(createWorkspaceSchema.safeParse({ ...create, actorUserId: id }).success, false);
});

test("creation rejects creating a predeleted workspace", () => {
  assert.equal(
    createWorkspaceSchema.safeParse({ ...create, deletedAt: "2026-11-18T12:00:00Z" }).success,
    false,
  );
});

test("creation rejects backdating workspace creation", () => {
  assert.equal(
    createWorkspaceSchema.safeParse({ ...create, createdAt: "2020-01-01T00:00:00Z" }).success,
    false,
  );
});

test("creation rejects overriding retention during creation", () => {
  assert.equal(createWorkspaceSchema.safeParse({ ...create, retentionDays: 1 }).success, false);
});

test("creation rejects injecting unrelated form state", () => {
  assert.equal(
    createWorkspaceSchema.safeParse({ ...create, publishedVersionId: id }).success,
    false,
  );
});

test("serialized prototype fields cannot bypass strict creation input", () => {
  const payload: unknown = JSON.parse(
    JSON.stringify(create).slice(0, -1) + ',"__proto__":{"role":"OWNER"}}',
  );
  assert.equal(createWorkspaceSchema.safeParse(payload).success, false);
});

test("settings reject ownership transfer through settings", () => {
  assert.equal(updateWorkspaceSchema.safeParse({ ...update, ownerUserId: id }).success, false);
});

test("settings reject changing stable workspace addresses", () => {
  assert.equal(
    updateWorkspaceSchema.safeParse({ ...update, slug: "other-address" }).success,
    false,
  );
});
