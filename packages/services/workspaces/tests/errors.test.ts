import assert from "node:assert/strict";
import test from "node:test";
import { postgresError, WorkspaceAccessError } from "../errors";

test("unwrap the original constraint from a Drizzle failure", () => {
  const original = { code: "23505", constraint: "workspaces_slug_unique" };
  assert.equal(postgresError(new Error("query failed", { cause: original })), original);
});

test("preserve errors through multiple wrapper layers", () => {
  const original = { code: "23503", constraint: "workspace_owner_fk" };
  assert.equal(postgresError({ cause: { cause: original } }), original);
});

test("terminate safely on circular error causes", () => {
  const error: { cause?: unknown } = {};
  error.cause = error;
  assert.equal(postgresError(error), undefined);
});

test("leave unrelated exceptions unclassified", () => {
  assert.equal(postgresError(new Error("connection unavailable")), undefined);
});

test("ignore non-object rejection reasons", () => {
  for (const error of [null, undefined, "failure", 123, true])
    assert.equal(postgresError(error), undefined);
});
