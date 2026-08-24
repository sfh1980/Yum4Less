import { test, expect } from "@playwright/test";
import { resetAppPreferences } from "./helpers";

/**
 * Narrow-viewport smoke — runs in the mobile-chrome Playwright project only.
 */
test.describe("Mobile layout smoke", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("shows setup and bottom nav on a phone viewport", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();
    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(mainNav.getByRole("button", { name: "Home" })).toBeVisible();
    await expect(mainNav.getByRole("button", { name: "Deals" })).toBeVisible();
    await expect(mainNav.getByRole("button", { name: "Settings" })).toBeVisible();
  });
});
