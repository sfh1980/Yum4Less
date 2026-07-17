import { test, expect } from "@playwright/test";
import { assertRecommendationsHaveMeals } from "@/lib/test-only/assert-recommendations-response";
import {
  completePantryAndSuggestRecipes,
  completeSettingsZipFlow,
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
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
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/market-search") &&
          res.request().method() === "POST",
        { timeout: 120_000 },
      ),
      page.getByRole("button", { name: "Find stores for this area" }).click(),
    ]);
    expect(response.status()).toBe(200);
    const marketBody = (await response.json()) as {
      market: {
        nearbyStores: Array<{ id: string; chain: string; recommendationEnabled: boolean }>;
      };
    };
    const kroger = marketBody.market.nearbyStores.find(
      (store) => store.chain === "kroger" && store.recommendationEnabled,
    );
    expect(kroger, "23111 fixture should include ranked Kroger for map overlay").toBeTruthy();

    const storeCombobox = page.getByRole("combobox", { name: "Store" });
    await expect(storeCombobox).toBeVisible({ timeout: 120_000 });
    await storeCombobox.selectOption(kroger!.id);
    const selectedOptionLabel = (await storeCombobox.locator("option:checked").textContent())?.trim();
    const expectedHeading = selectedOptionLabel?.replace(/\s*\([^)]*\)\s*$/, "").trim();
    expect(
      expectedHeading,
      "selected store option label should include the map overlay title",
    ).toBeTruthy();

    await page.getByRole("button", { name: "📍 Show on map" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: expectedHeading! })).toBeVisible();
    await expect(page.locator(".single-store-map-overlay .nearby-stores-map")).toBeVisible();

    // Click the dimmed backdrop outside the panel — not the viewport center (panel/map).
    await page
      .locator(".single-store-map-overlay .map-overlay-backdrop")
      .click({ position: { x: 12, y: 12 } });
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Store" })).toBeVisible();
  });

  test("opens from meal card primary store pill on mobile viewport", async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);
    // Couple to POST /api/recommendations — "Dinner recommendations" heading alone is not
    // a rank-completion signal (false sync caused the historical accordion flake).
    const { body } = await completePantryAndSuggestRecipes(page);
    assertRecommendationsHaveMeals(body);

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
