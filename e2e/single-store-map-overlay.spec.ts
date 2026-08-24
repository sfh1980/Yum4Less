import { test, expect } from "@playwright/test";
import { assertRecommendationsHaveMeals } from "@/lib/test-only/assert-recommendations-response";
import {
  completePantryAndSuggestRecipes,
  completeSettingsZipFlow,
  completeWelcomeFlow,
  resetAppPreferences,
  searchStoresFromZipWizard,
} from "./helpers";

test.describe("Single-store map overlay", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("opens from Settings single-store picker and dismisses without losing form state", async ({
    page,
  }) => {
    const response = await searchStoresFromZipWizard(page);
    const marketBody = (await response.json()) as {
      market: {
        nearbyStores: Array<{
          id: string;
          chain: string;
          recommendationEnabled: boolean;
          name?: string;
        }>;
      };
    };
    const kroger = marketBody.market.nearbyStores.find(
      (store) => store.chain === "kroger" && store.recommendationEnabled,
    );
    expect(kroger, "23111 fixture should include ranked Kroger for map overlay").toBeTruthy();
    await page.getByRole("button", { name: "Continue" }).click();

    const mapButton = page.getByRole("button", { name: new RegExp(`Show .* on map`) }).first();
    await expect(mapButton).toBeVisible({ timeout: 30_000 });
    await mapButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".single-store-map-overlay .nearby-stores-map")).toBeVisible();

    // Click the dimmed backdrop outside the panel — not the viewport center (panel/map).
    await page
      .locator(".single-store-map-overlay .map-overlay-backdrop")
      .click({ position: { x: 12, y: 12 } });
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Which stores should we use?" }),
    ).toBeVisible();
  });

  test("opens from meal card store plan on mobile viewport", async ({ page }) => {
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

    const expandedPanel = page.locator(".meal-results-accordion-panel").first();
    await expandedPanel.getByRole("button", { name: "Store plan" }).click();
    await expandedPanel.getByRole("button", { name: /Show Kroger on map/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Kroger —/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible();
  });
});
