import assert from "node:assert/strict";
import test from "node:test";
import { hasWorkspaceCapability } from "../permissions";

test("owner can workspace read", () => {
  assert.equal(hasWorkspaceCapability("OWNER", "workspace:read"), true);
});
