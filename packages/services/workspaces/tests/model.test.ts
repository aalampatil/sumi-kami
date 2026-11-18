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
