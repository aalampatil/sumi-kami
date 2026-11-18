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
  await expect(page.getByTestId("account-overview")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.Clerk?.session))).toBe(true);
  return { email, token: await page.evaluate(() => window.Clerk.session!.getToken()) };
}
