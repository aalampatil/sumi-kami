import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
test("public pages, mobile navigation and the unsaved demo work without an account", async ({
  page,
}) => {
  await setupClerkTestingToken({ page });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Make every");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await page.screenshot({ path: "test-results/landing-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/landing-mobile.png", fullPage: true });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Features", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Thoughtful by design");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Our approach", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A question is");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Try a form", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveCount(2);
  await page.getByLabel(/What should we call you/).fill("Avery");
  await page.getByRole("radio", { name: "5 of 5", exact: true }).check();
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /submissions|public\.submit/.test(request.url()))
      submissions++;
  });
  await page.getByRole("button", { name: "Submit response", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "That’s the art of asking.", exact: true }),
  ).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByRole("button", { name: "Restart preview", exact: true }).click();
  await expect(page.getByLabel(/What should we call you/)).toHaveValue("");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
