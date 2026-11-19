import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createWorkspaceTestAccount } from "./helpers";
import { readFile } from "node:fs/promises";
import { newField } from "@repo/form-core/definition";
import { customAppearance } from "@repo/form-core/appearance";
import type { FormEditor } from "@repo/trpc/client";

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

test("compound conditions survive publishing and route public answers only to later steps", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240000);
  const account = await createWorkspaceTestAccount(page);
  const headers = { Authorization: "Bearer " + account.token };
  const workspaceResponse = await request.post("http://localhost:8000/api/workspaces", {
    headers,
    data: { name: "Logic studio", slug: "logic-" + randomUUID() },
  });
  expect(workspaceResponse.status()).toBe(200);
  const workspace = (await workspaceResponse.json()) as { id: string };
  const base = "http://localhost:8000/api/workspaces/" + workspace.id + "/forms";
  const created = await request.post(base, {
    headers,
    data: { title: "Conditional conversation" },
  });
  expect(created.status()).toBe(200);
  const form = (await created.json()) as FormEditor;
  const code = newField(),
    consent = newField("CHECKBOX"),
    details = newField(),
    finish = newField();
  code.label = "Your code";
  consent.label = "Continue with details?";
  details.label = "Extra details";
  details.required = true;
  finish.label = "Final thought";
  finish.required = true;
  form.definition.steps = [
    { key: "main", title: "Start", fields: [code, consent] },
    { key: "details", title: "Details", fields: [details] },
    { key: "finish", title: "Finish", fields: [finish] },
  ];
  form.definition.settings.appearance = customAppearance("#FFFFFF", "#FFFFFF");
  expect(
    (
      await request.put(base + "/" + form.id + "/draft", {
        headers,
        data: {
          expectedRevision: form.revision,
          definition: form.definition,
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/dashboard/workspaces/" + workspace.id + "/forms/" + form.id);
  await page.getByLabel("Form title", { exact: true }).fill("Unsaved conditions");
  const cancelledNavigation = page.waitForEvent("dialog");
  const sidebarClick = page
    .getByRole("navigation", { name: "Dashboard", exact: true })
    .getByRole("link", { name: "Workspaces", exact: true })
    .click();
  const warning = await cancelledNavigation;
  expect(warning.message()).toContain("Leave without saving");
  await warning.dismiss();
  await sidebarClick;
  await expect(page).toHaveURL(new RegExp("/forms/" + form.id + "$"));
  await expect(page.getByLabel("Form title", { exact: true })).toHaveValue("Unsaved conditions");
  await page.getByLabel("Form title", { exact: true }).fill("Conditional conversation");
  const editor = page.getByRole("complementary", { name: "Editor settings" });
  await editor.getByRole("button", { name: "Form settings", exact: true }).click();
  await editor.getByRole("button", { name: "Add logic rule", exact: true }).click();
  const rule = editor.getByRole("region", { name: "Rule 1", exact: true });
  await rule.getByLabel("When this question is reached").selectOption(consent.key);
  await rule.getByRole("combobox", { name: "Match", exact: true }).selectOption("all");
  await rule.getByRole("combobox", { name: "Match", exact: true }).nth(1).selectOption("any");
  await rule.getByRole("combobox", { name: "Condition", exact: true }).selectOption("equals");
  await rule.getByLabel("Comparison value").fill("go");
  await rule.getByRole("button", { name: "Add condition", exact: true }).first().click();
  await rule
    .getByRole("combobox", { name: "Question to compare", exact: true })
    .nth(1)
    .selectOption(code.key);
  await rule
    .getByRole("combobox", { name: "Condition", exact: true })
    .nth(1)
    .selectOption("equals");
  await rule.getByLabel("Comparison value").nth(1).fill("fast");
  await rule.getByRole("button", { name: "Add condition", exact: true }).last().click();
  await rule.getByRole("combobox", { name: "Match", exact: true }).last().selectOption("not");
  await rule
    .getByRole("combobox", { name: "Condition", exact: true })
    .last()
    .selectOption("equals");
  await rule.getByLabel("Comparison value").last().selectOption("false");
  await rule.getByRole("combobox", { name: "Then", exact: true }).selectOption("GO_TO_STEP");
  await expect(rule.getByRole("combobox", { name: "Target step", exact: true })).toHaveValue(
    "details",
  );
  await expect(
    rule.getByRole("combobox", { name: "Target step", exact: true }).locator("option"),
  ).toHaveCount(3);
  await rule.getByRole("combobox", { name: "Target step", exact: true }).selectOption("finish");
  await page.getByRole("button", { name: "Publish form", exact: true }).click();
  await expect(page.getByText("Your form is live and accepting responses.")).toBeVisible();
  await page.reload();
  await editor.getByRole("button", { name: "Form settings", exact: true }).click();
  await expect(rule.getByRole("combobox", { name: "Match", exact: true }).first()).toHaveValue(
    "all",
  );
  await expect(rule.getByRole("combobox", { name: "Match", exact: true }).nth(1)).toHaveValue(
    "any",
  );
  await expect(rule.getByRole("combobox", { name: "Match", exact: true }).nth(4)).toHaveValue(
    "not",
  );
  const anonymous = await browser.newContext({ baseURL: "http://localhost:3001" });
  try {
    const respondent = await anonymous.newPage();
    await respondent.goto("/f/" + form.slug);
    await respondent.getByRole("textbox", { name: "Your code", exact: true }).fill("wait");
    await respondent.getByRole("checkbox", { name: /Continue with details/ }).check();
    await expect(respondent.getByLabel(/Extra details/)).toBeVisible();
    await respondent.getByRole("textbox", { name: "Your code", exact: true }).fill("go");
    await expect(respondent.getByLabel(/Extra details/)).toHaveCount(0);
    await respondent.getByRole("checkbox", { name: /Continue with details/ }).uncheck();
    await expect(respondent.getByLabel(/Extra details/)).toBeVisible();
    await respondent.getByRole("checkbox", { name: /Continue with details/ }).check();
    await expect(respondent.getByLabel(/Extra details/)).toHaveCount(0);
    await respondent.getByLabel(/Final thought/).fill("A routed answer");
    await respondent.keyboard.press("Tab");
    await respondent.keyboard.press("Shift+Tab");
    const focus = await respondent.getByLabel(/Final thought/).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outline: style.outlineColor,
        background: style.backgroundColor,
        width: style.outlineWidth,
      };
    });
    expect(focus.outline).not.toBe(focus.background);
    expect(focus.width).toBe("2px");
    await respondent.getByRole("button", { name: "Submit response", exact: true }).click();
    await expect(
      respondent.getByRole("heading", { name: "Thank you.", exact: true }),
    ).toBeVisible();
  } finally {
    await anonymous.close();
  }
  const response = await request.get(base + "/" + form.id + "/responses?limit=20", { headers });
  expect(response.status()).toBe(200);
  const result = (await response.json()) as {
    items: { answers: { fieldKey: string; text: string }[] }[];
  };
  expect(result.items[0]!.answers.map((answer) => answer.fieldKey).sort()).toEqual(
    [code.key, consent.key, finish.key].sort(),
  );
});
