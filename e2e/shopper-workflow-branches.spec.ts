import { test, expect } from "@playwright/test";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
  goToZipInput,
  resetAppPreferences,
  seedZipSearchCenter,
  switchMainTab,
} from "./helpers";

test.describe("Shopper workflow branches", () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("chrome Back returns from ZIP input to choose location", async ({
    page,
  }) => {
    await goToZipInput(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Let’s get started" }),
    ).toBeVisible();
  });

  test("chrome Back returns from radius to the ZIP pin", async ({ page }) => {
    await goToZipInput(page);
    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await seedZipSearchCenter(page, E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Place your pin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "How far should we look?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Place your pin" })).toBeVisible();
  });

  test("Reset Preferences returns to first-run splash", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await switchMainTab(page, "Settings");
    await expect(
      page.getByRole("heading", { name: "Let’s get started" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset Preferences" }).click();
    const splash = page.getByTestId("onboarding-splash");
    await expect(splash).toBeVisible();
    await splash.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Let’s get started" }),
    ).toBeVisible();
  });

  test("manual sale-item pick continues to pantry", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);
    await expect(
      page.getByRole("button", { name: "Use everything on sale" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Choose specific sale items" }).click();
    const continueToPantry = page.getByRole("button", {
      name: "Continue to pantry check",
    });
    await expect(continueToPantry).toBeDisabled();
    await page.locator(".sale-ingredient-list input[type='checkbox']").first().check();
    await expect(continueToPantry).toBeEnabled();
    await continueToPantry.click();
    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
  });

  test("cuisine chips toggle when enough dinners match, otherwise stay hidden", async ({
    page,
  }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
    const cuisineToolbar = page.getByRole("toolbar", { name: "Cuisine filters" });
    if ((await cuisineToolbar.count()) > 0) {
      const cuisineChip = cuisineToolbar
        .getByRole("button")
        .filter({ hasNotText: "Any cuisine" })
        .first();
      await cuisineChip.click();
      await expect(cuisineChip).toHaveAttribute("aria-pressed", "true");
      await cuisineToolbar.getByRole("button", { name: "Any cuisine" }).click();
    }
    await expect(
      page.getByRole("button", { name: "Use everything on sale" }),
    ).toBeVisible();
  });
});
