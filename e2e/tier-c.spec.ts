import { test, expect } from "@playwright/test";
import {
  buildTierCMarketSearchResponse,
} from "./fixtures/api-mocks";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  openMapOverlay,
  resetAppPreferences,
  switchMainTab,
} from "./helpers";

test.describe("Tier C — map context without ranked meals", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
    await page.route("**/api/market-search", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildTierCMarketSearchResponse()),
      });
    });
  });

  test("blocks ranking and shows honest limited-coverage copy", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);

    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
    await expect(
      page.getByText(/No sale ingredients are available for your selected store\(s\) yet/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Suggest recipes for my store(s)" })).toHaveCount(0);

    await openMapOverlay(page);
    await expect(page.getByRole("dialog", { name: "Store locations" })).toBeVisible();

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await switchMainTab(page, "Deals");
    await expect(
      page.getByText(/No sale items are available for your selected store\(s\) yet/i),
    ).toBeVisible();
  });
});
