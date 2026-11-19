import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createWorkspaceTestAccount } from "./helpers";
test("a verified teammate joins by invitation, changes role, and loses access when removed", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240000);
  const owner = await createWorkspaceTestAccount(page);
  const workspaceResponse = await request.post("http://localhost:8000/api/workspaces", {
    headers: { Authorization: "Bearer " + owner.token },
    data: { name: "Collaborative studio", slug: "team-" + randomUUID() },
  });
  expect(workspaceResponse.status()).toBe(200);
  const workspace = (await workspaceResponse.json()) as { id: string };
  const context = await browser.newContext({ baseURL: "http://localhost:3001" });
  try {
    const recipient = await context.newPage(),
      account = await createWorkspaceTestAccount(recipient);
    await page.goto("/dashboard/workspaces/" + workspace.id + "/members");
    await page.getByLabel("Email address", { exact: true }).fill(account.email);
    await page.getByLabel("Role", { exact: true }).selectOption("EDITOR");
    await page.getByRole("button", { name: "Create invitation", exact: true }).click();
    const link = await page.getByLabel("Invitation link").inputValue();
    expect(link.includes("/invite#")).toBe(true);
    await recipient.goto(link);
    await recipient.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await recipient.getByRole("link", { name: "Open workspace", exact: false }).click();
    await expect(
      recipient.getByRole("heading", { name: "Collaborative studio", exact: true }),
    ).toBeVisible();
    await expect(recipient.getByRole("button", { name: "Create form", exact: true })).toBeVisible();
    await page.reload();
    const role = page
      .getByRole("combobox")
      .filter({ has: page.locator('option[value="VIEWER"]') })
      .first();
    // The first member role control follows the owner, who has a fixed role badge.
    await role.selectOption("VIEWER");
    await expect(role).toHaveValue("VIEWER");
    await recipient.reload();
    await expect(recipient.getByRole("button", { name: "Create form", exact: true })).toHaveCount(
      0,
    );
    expect(
      (
        await request.post(`http://localhost:8000/api/workspaces/${workspace.id}/forms`, {
          headers: { Authorization: "Bearer " + account.token },
          data: { title: "Denied" },
        })
      ).status(),
    ).toBe(403);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^Remove / }).click();
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await recipient.reload();
    await expect(
      recipient.getByRole("heading", { name: "Workspace not found", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
