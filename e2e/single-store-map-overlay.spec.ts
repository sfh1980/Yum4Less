import { test, expect } from "@playwright/test";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
  goToPantryStep,
  resetAppPreferences,
} from "./helpers";

test.describe("Single-store map overlay", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("opens from Settings single-store picker and dismisses without losing form state", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Find stores for this area" }).click();
    await expect(page.getByRole("combobox", { name: "Store" })).toBeVisible({
      timeout: 120_000,
    });

    await page.getByRole("combobox", { name: "Store" }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "📍 Show on map" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Kroger —/ })).toBeVisible();
    await expect(page.locator(".single-store-map-overlay .nearby-stores-map")).toBeVisible();

    // Click the dimmed backdrop outside the panel — not the viewport center (panel/map).
    await page
      .locator(".single-store-map-overlay .map-overlay-backdrop")
      .click({ position: { x: 12, y: 12 } });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Store" })).toBeVisible();
  });

  test("opens from meal card primary store pill on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);
    await goToPantryStep(page);
    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible({
      timeout: 30_000,
    });

    const firstMealTrigger = page.locator(".meal-results-accordion-trigger").first();
    await expect(firstMealTrigger).toBeVisible({ timeout: 30_000 });
    await firstMealTrigger.click();

    await page.getByRole("button", { name: /Show Kroger on map/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Kroger —/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible();
  });
});
