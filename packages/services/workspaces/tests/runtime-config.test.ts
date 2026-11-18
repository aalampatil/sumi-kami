import assert from "node:assert/strict";
import test from "node:test";
import { tenantConnectionString } from "../../../database/runtime-config";

test("require an explicit tenant credential", () => {
  assert.throws(() => tenantConnectionString({}), /TENANT_DATABASE_URL/);
});

test("reject whitespace-only tenant credentials", () => {
  assert.throws(() => tenantConnectionString({ TENANT_DATABASE_URL: "  " }), /restricted/);
});

test("reject non-URL tenant settings", () => {
  assert.throws(
    () => tenantConnectionString({ TENANT_DATABASE_URL: "not a database URL" }),
    /PostgreSQL URL/,
  );
});
