import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createWorkspaceTestAccount } from "./helpers";
import { readFile } from "node:fs/promises";

test("a creator publishes a form, receives a mobile response with a private attachment, and preserves history", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240000);
  const account = await createWorkspaceTestAccount(page),
    headers = { Authorization: "Bearer " + account.token };
  const created = await request.post("http://localhost:8000/api/workspaces", {
    headers,
    data: { name: "Form studio", slug: "forms-" + randomUUID() },
  });
  expect(created.status()).toBe(200);
  const workspace = (await created.json()) as { id: string };
  await page.goto("/dashboard/workspaces/" + workspace.id);
  await page.getByRole("button", { name: "Create form", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Form title").fill("A thoughtful conversation");
  await dialog.getByRole("button", { name: "Create form", exact: true }).click();
  await expect(page.getByLabel("Form title")).toHaveValue("A thoughtful conversation");
  const editor = page.getByRole("complementary", { name: "Editor settings" });
  await editor.getByLabel("Question label", { exact: true }).fill("Your name");
  await editor.getByLabel("Required question").check();
  await page.getByLabel("New question type").selectOption("EMAIL");
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await editor.getByLabel("Question label", { exact: true }).fill("Contact email");
  await editor.getByLabel("Required question").check();
  await page.getByLabel("New question type").selectOption("FILE");
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await editor.getByLabel("Question label", { exact: true }).fill("Supporting note");
  await editor.getByLabel("Required question").check();
  await page.getByRole("button", { name: "Publish form", exact: true }).click();
  await expect(page.getByText("Your form is live and accepting responses.")).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Open form", exact: true })
    .getAttribute("href");
  expect(href).toMatch(/^\/f\//);
  const editorUrl = page.url();
  const anonymous = await browser.newContext({
    baseURL: "http://localhost:3001",
    viewport: { width: 375, height: 812 },
  });
  try {
    const respondent = await anonymous.newPage();
    await respondent.goto(href!);
    await expect(
      respondent.getByRole("heading", { name: "A thoughtful conversation", exact: true }),
    ).toBeVisible();
    await respondent.getByRole("button", { name: "Submit response", exact: true }).click();
    await expect(respondent.locator("form").getByRole("alert")).toHaveCount(3);
    await respondent.getByLabel(/Your name/).fill("Avery");
    await respondent.getByLabel(/Contact email/).fill("avery@example.com");
    await respondent.getByLabel(/Supporting note/).setInputFiles({
      name: "hello.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("A real private response attachment."),
    });
    const submitted = respondent.waitForResponse(
      (response) =>
        response.url().includes("/submissions") && response.request().method() === "POST",
    );
    await respondent.getByRole("button", { name: "Submit response", exact: true }).click();
    expect((await submitted).status()).toBe(200);
    await expect(
      respondent.getByRole("heading", { name: "Thank you.", exact: true }),
    ).toBeVisible();
    expect(
      await respondent.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await respondent.screenshot({ path: "test-results/respondent-mobile.png", fullPage: true });
  } finally {
    await anonymous.close();
  }
  await page.getByRole("link", { name: "Responses", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "View response" }).click();
  const details = page.getByRole("dialog");
  await expect(details.getByText("Avery", { exact: true })).toBeVisible();
  await expect(details.getByText("avery@example.com", { exact: true })).toBeVisible();
  const fileDownload = page.waitForEvent("download");
  await details.getByRole("button", { name: "Download file 1" }).click();
  expect((await fileDownload).suggestedFilename()).toBe("hello.txt");
  await page.keyboard.press("Escape");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this page", exact: true }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect(await readFile((await csv.path())!, "utf8")).toContain("Avery");
  await page.goto(editorUrl);
  await page.getByRole("button", { name: "Edit form", exact: true }).click();
  await page.getByRole("button", { name: "Your name", exact: true }).click();
  await editor.getByLabel("Question label", { exact: true }).fill("Your full name");
  await page.getByRole("button", { name: "Publish form", exact: true }).click();
  await expect(page.getByText("Your form is live and accepting responses.")).toBeVisible();
  await page.getByRole("link", { name: "Responses", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "View response" }).click();
  await expect(page.getByRole("dialog").getByText("Your name", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Version 1", { exact: false })).toBeVisible();
  const other = await browser.newContext({ baseURL: "http://localhost:3001" });
  try {
    const outsider = await other.newPage();
    await createWorkspaceTestAccount(outsider);
    await outsider.goto(editorUrl);
    await expect(
      outsider.getByRole("heading", { name: "Workspace not found", exact: true }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});
