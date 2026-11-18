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
