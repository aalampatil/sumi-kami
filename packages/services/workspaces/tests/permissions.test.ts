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

test("owner can forms edit", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "forms:edit"), true);
});

test("owner can forms publish", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "forms:publish"), true);
});

test("owner can responses read", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "responses:read"), true);
});

test("owner can responses export", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "responses:export"), true);
});

test("admin can workspace read", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "workspace:read"), true);
});

test("admin can workspace update", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "workspace:update"), true);
});
