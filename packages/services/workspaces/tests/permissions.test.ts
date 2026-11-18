import assert from "node:assert/strict";
import test from "node:test";
import { hasWorkspaceCapability } from "../permissions";

test("owner can workspace read", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "workspace:read"), true);
});

test("owner can workspace update", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "workspace:update"), true);
});

test("owner can members manage", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "members:manage"), true);
});

test("owner can forms read", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "forms:read"), true);
});
