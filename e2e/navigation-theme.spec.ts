import { test, expect } from "@playwright/test";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  resetAppPreferences,
  runCoreMvpFlow,
  switchMainTab,
} from "./helpers";

test.describe("Bottom navigation and theme", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("routes across main tabs and disables Cook until recipes exist", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);

    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(mainNav.getByRole("button", { name: "Cook" })).toBeDisabled();

    await switchMainTab(page, "Deals");
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();

    await switchMainTab(page, "Saved");
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();

    await switchMainTab(page, "Settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await switchMainTab(page, "Home");
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  });

  test("enables Cook tab after ranked recipes are ready", async ({ page }) => {
    await runCoreMvpFlow(page);
    const cookButton = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Cook" });
    await expect(cookButton).toBeEnabled();
    await cookButton.click();
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible();
  });

  test("applies dark theme from Settings", async ({ page }) => {
    await page.getByRole("combobox", { name: "Theme" }).selectOption("Dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("combobox", { name: "Theme" }).selectOption("Light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
