import { test, expect } from "@playwright/test";
import {
  buildMarketSearchErrorResponse,
  buildRecommendationsErrorResponse,
} from "./fixtures/api-mocks";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
  goToPantryStep,
  resetAppPreferences,
  switchMainTab,
} from "./helpers";

test.describe("API error surfaces in the UI", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("shows market-search 400 copy on the Deals tab", async ({ page }) => {
    const error = buildMarketSearchErrorResponse(
      400,
      "Market search payload is invalid.",
    );
    await page.route("**/api/market-search", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: error.status,
        contentType: "application/json",
        body: JSON.stringify(error.body),
      });
    });

    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Find stores for this area" }).click();

    await switchMainTab(page, "Deals");
    await expect(page.getByText(/ZIP must be five digits/i)).toBeVisible();
  });

  test("shows market-search 500 copy on the Deals tab", async ({ page }) => {
    const error = buildMarketSearchErrorResponse(500, "Internal server error.");
    await page.route("**/api/market-search", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: error.status,
        contentType: "application/json",
        body: JSON.stringify(error.body),
      });
    });

    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Find stores for this area" }).click();

    await switchMainTab(page, "Deals");
    await expect(page.getByText(/Internal server error|temporarily unavailable/i)).toBeVisible();
  });

  test("shows recommendations 500 copy after rank request", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);
    await goToPantryStep(page);

    const error = buildRecommendationsErrorResponse(
      500,
      "Recommendations are temporarily unavailable.",
    );
    await page.route("**/api/recommendations", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: error.status,
        contentType: "application/json",
        body: JSON.stringify(error.body),
      });
    });

    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    await expect(
      page.getByRole("heading", { name: "Recommendations are temporarily unavailable" }),
    ).toBeVisible();
  });

  test("shows recommendations 400 body-too-large copy", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);
    await goToPantryStep(page);

    const error = buildRecommendationsErrorResponse(400, "Request body is too large.");
    await page.route("**/api/recommendations", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: error.status,
        contentType: "application/json",
        body: JSON.stringify(error.body),
      });
    });

    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    await expect(
      page.getByRole("heading", { name: "Too much store data to rank at once" }),
    ).toBeVisible();
  });
});
