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

test("admin can members manage", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "members:manage"), true);
});

test("admin can forms read", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "forms:read"), true);
});

test("admin can forms edit", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "forms:edit"), true);
});

test("admin can forms publish", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "forms:publish"), true);
});

test("admin can responses read", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "responses:read"), true);
});

test("admin can responses export", () => {
  assert.equal(hasWorkspaceCapability("ADMIN", "responses:export"), true);
});

test("editor can workspace read", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "workspace:read"), true);
});

test("editor cannot workspace update", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "workspace:update"), false);
});

test("editor cannot members manage", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "members:manage"), false);
});

test("editor can forms read", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "forms:read"), true);
});

test("editor can forms edit", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "forms:edit"), true);
});

test("editor can forms publish", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "forms:publish"), true);
});

test("editor can responses read", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "responses:read"), true);
});

test("editor can responses export", () => {
  assert.equal(hasWorkspaceCapability("EDITOR", "responses:export"), true);
});

test("viewer can workspace read", () => {
  assert.equal(hasWorkspaceCapability("VIEWER", "workspace:read"), true);
});

test("viewer cannot workspace update", () => {
  assert.equal(hasWorkspaceCapability("VIEWER", "workspace:update"), false);
});
