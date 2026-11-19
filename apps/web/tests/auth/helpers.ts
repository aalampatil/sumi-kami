import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export async function createWorkspaceTestAccount(page: Page) {
  await setupClerkTestingToken({ page });
  const email = "workspace-" + randomUUID() + "+clerk_test@example.com";
  await page.goto("/sign-up");
  await clerk.loaded({ page });
  await page.getByLabel("Email address", { exact: true }).fill(email);
  const password = page.getByLabel("Password", { exact: true });
  if (await password.count()) await password.fill("Sumi-" + randomUUID() + "-9a!");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const verification = page.locator('input[autocomplete="one-time-code"]');
  await expect(async () => {
    if (await verification.isVisible()) await verification.fill("424242");
    await expect(page).toHaveURL(/\/dashboard/);
  }).toPass({ timeout: 45000 });
  await expect.poll(() => page.evaluate(() => Boolean(window.Clerk?.session))).toBe(true);
  const token = await page.evaluate(() => window.Clerk.session!.getToken());
  const response = await page.request.get("http://localhost:8000/api/authentication/me", {
    headers: { Authorization: "Bearer " + token },
  });
  const body = await response.json();
  expect(
    response.status(),
    JSON.stringify({
      status: response.status(),
      message: body?.message ?? body?.error?.message ?? body?.error,
    }),
  ).toBe(200);
  await expect(page.getByTestId("account-overview")).toBeVisible();
  return { email, token };
}
