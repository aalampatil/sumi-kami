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

test("a creator manages a workspace while a second account remains isolated", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);
  const account = await createWorkspaceTestAccount(page);
  await expect(page.getByRole("heading", { name: "A blank canvas, together" })).toBeVisible();
  const name = "Design studio " + randomUUID().slice(0, 8);
  const slug = "studio-" + randomUUID();
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Workspace name")).toBeFocused();
  await dialog.getByLabel("Workspace name").fill(name);
  await expect(dialog.getByLabel("Workspace address")).not.toHaveValue("");
  await dialog.getByLabel("Workspace address").fill(slug);
  await dialog.getByLabel("Workspace name").fill(name + " team");
  await expect(dialog.getByLabel("Workspace address")).toHaveValue(slug);
  await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/workspaces\/[0-9a-f-]+/);
  const workspaceUrl = page.url();
  const id = workspaceUrl.split("/").at(-1)!;
  await expect(page.getByRole("heading", { name: name + " team", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Workspace name").fill(name + " renamed");
  await page.getByLabel("Response retention (days)").fill("30");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText("Workspace settings saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Workspace name")).toHaveValue(name + " renamed");
  await expect(page.getByLabel("Response retention (days)")).toHaveValue("30");
  const headers = { Authorization: "Bearer " + account.token };
  const details = await request.get(api + "/workspaces/" + id, { headers });
  expect(details.status()).toBe(200);
  expect(await details.json()).toMatchObject({
    id,
    name: name + " renamed",
    slug,
    role: "OWNER",
    retentionDays: 30,
  });
  const listing = await request.get(api + "/workspaces?limit=1", { headers });
  expect(listing.status()).toBe(200);
  expect((await listing.json()).items).toHaveLength(1);
  await page.getByRole("link", { name: "All workspaces", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your workspaces", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: name + " renamed", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Your workspaces", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const context = await browser.newContext({ baseURL: "http://localhost:3001" });
  try {
    const other = await context.newPage();
    const second = await createWorkspaceTestAccount(other);
    const otherHeaders = { Authorization: "Bearer " + second.token };
    expect((await request.get(api + "/workspaces/" + id, { headers: otherHeaders })).status()).toBe(
      404,
    );
    expect((await request.get(api + "/workspaces", { headers: otherHeaders })).status()).toBe(200);
    await other.goto(workspaceUrl);
    await expect(
      other.getByRole("heading", { name: "Workspace not found", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  await page.screenshot({ path: "test-results/workspace-dashboard-mobile.png", fullPage: true });
});

test("duplicate addresses keep the creator dialog open with actionable feedback", async ({
  page,
  request,
}) => {
  const account = await createWorkspaceTestAccount(page);
  const slug = "duplicate-" + randomUUID();
  const created = await request.post(api + "/workspaces", {
    headers: { Authorization: "Bearer " + account.token },
    data: { name: "Existing studio", slug },
  });
  expect(created.status()).toBe(200);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Workspace name").fill("Duplicate studio");
  await dialog.getByLabel("Workspace address").fill(slug);
  const response = page.waitForResponse((result) => result.url().includes("workspaces.create"));
  await dialog.getByRole("button", { name: "Create workspace", exact: true }).click();
  const duplicate = await response;
  expect(duplicate.status()).toBe(409);
  await expect(dialog.getByRole("alert")).toContainText("already in use");
  await expect(dialog.getByLabel("Workspace address")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByLabel("Workspace address")).toHaveValue(slug);
});
