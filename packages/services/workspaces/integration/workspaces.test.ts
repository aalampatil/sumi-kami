import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { withWorkspaceDiscovery } from "@repo/database/discovery";
import { withAuthorizedWorkspace } from "@repo/database/tenant";
import { WorkspaceAccessError } from "../errors";
import { getFixture } from "./fixture";

async function accessFailure(
  operation: () => Promise<unknown>,
  reason: "NOT_FOUND" | "FORBIDDEN" | "SLUG_TAKEN",
) {
  await assert.rejects(
    operation,
    (error) => error instanceof WorkspaceAccessError && error.reason === reason,
  );
}
