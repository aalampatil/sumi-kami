import assert from "node:assert/strict";
import test from "node:test";
import { postgresError, WorkspaceAccessError } from "../errors";

test("unwrap the original constraint from a Drizzle failure", () => {
  const original = { code: "23505", constraint: "workspaces_slug_unique" };
  assert.equal(postgresError(new Error("query failed", { cause: original })), original);
});
