import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createWorkspaceTestAccount } from "./helpers";
const api = "http://localhost:8000/api";

test("workspace REST operations require independently verified authentication", async ({
  request,
}) => {
  const id = randomUUID();
  expect((await request.get(api + "/workspaces")).status()).toBe(401);
  expect(
    (
      await request.post(api + "/workspaces", { data: { name: "Anonymous", slug: "anonymous" } })
    ).status(),
  ).toBe(401);
  expect((await request.get(api + "/workspaces/" + id)).status()).toBe(401);
  expect(
    (
      await request.patch(api + "/workspaces/" + id, {
        data: { name: "Anonymous", retentionDays: null },
      })
    ).status(),
  ).toBe(401);
});
