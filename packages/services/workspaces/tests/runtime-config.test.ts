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

test("reject HTTP URLs as database credentials", () => {
  assert.throws(
    () =>
      tenantConnectionString({ TENANT_DATABASE_URL: "https://runtime:secret@example.invalid/db" }),
    /PostgreSQL/,
  );
});

test("require a named runtime login", () => {
  assert.throws(
    () => tenantConnectionString({ TENANT_DATABASE_URL: "postgresql://localhost/workspace_dev" }),
    /login/,
  );
});

test("require an explicit target database", () => {
  assert.throws(
    () => tenantConnectionString({ TENANT_DATABASE_URL: "postgresql://runtime:secret@localhost/" }),
    /database/,
  );
});

test("preserve encoded credentials without accidental interpolation", () => {
  const value = "postgresql://runtime:p%24%24%40word@127.0.0.1:55433/workspace_dev?sslmode=disable";
  assert.equal(tenantConnectionString({ TENANT_DATABASE_URL: value }), value);
});

test("accept the supported postgres scheme", () => {
  const value = "postgres://runtime:secret@localhost/workspace_dev";
  assert.equal(tenantConnectionString({ TENANT_DATABASE_URL: value }), value);
});
