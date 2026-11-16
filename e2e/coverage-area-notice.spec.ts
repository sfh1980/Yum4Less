import { expect, test } from "@playwright/test";
import { buildTierCMarketSearchResponse } from "./fixtures/api-mocks";
import { resetAppPreferences, searchStoresFromZipWizard } from "./helpers";

test.describe("coverage wording before store setup", () => {
  test("says where dinner estimates are available on the first location step", async ({
    page,
  }) => {
    await resetAppPreferences(page);
    await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();
    await expect(
      page.getByText(
        /Dinner price estimates are available today in .+\. Elsewhere you will see nearby stores while coverage grows\./,
      ),
    ).toBeVisible();
  });

  test("shows the tier C reason before the store picker when no stores are priced", async ({
    page,
  }) => {
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

    await searchStoresFromZipWizard(page);
    await expect(page.getByRole("heading", { name: "How do you shop?" })).toBeVisible();
    await expect(
      page.getByText(
        "Yum4Less found nearby stores, but none have enough sale prices for dinner estimates right now. Other map pins may be for planning only.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Which stores should we use?" }),
    ).toHaveCount(0);
  });
});
