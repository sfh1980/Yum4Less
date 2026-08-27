import { test, expect } from "@playwright/test";
import {
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
  goToZipInput,
  resetAppPreferences,
  searchStoresFromZipWizard,
} from "./helpers";

test.describe("Settings store selection", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("scopes the map to the stores selected in Settings (ranked-chain subset)", async ({ page }) => {
    await searchStoresFromZipWizard(page, E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Several stores" }).click();
    await expect(
      page.getByRole("heading", { name: "Which stores should we use?" }),
    ).toBeVisible();

    await page.locator("#wizard-store-kroger-mechanicsville").check();
    await page.locator("#wizard-store-aldi-mechanicsville").check();

    const publixCheckboxes = page.getByRole("checkbox", { name: /Publix —/ });
    for (let index = 0; index < await publixCheckboxes.count(); index += 1) {
      await publixCheckboxes.nth(index).uncheck();
    }

    const foodLionCheckboxes = page.getByRole("checkbox", { name: /Food Lion —/ });
    for (let index = 0; index < await foodLionCheckboxes.count(); index += 1) {
      await foodLionCheckboxes.nth(index).uncheck();
    }

    const lidlCheckboxes = page.getByRole("checkbox", { name: /Lidl —/ });
    for (let index = 0; index < await lidlCheckboxes.count(); index += 1) {
      await lidlCheckboxes.nth(index).uncheck();
    }

    const walmartCheckboxes = page.getByRole("checkbox", { name: /Walmart —/ });
    for (let index = 0; index < await walmartCheckboxes.count(); index += 1) {
      await walmartCheckboxes.nth(index).uncheck();
    }

    await page.getByRole("button", { name: "Continue" }).click();
    await completeWelcomeFlow(page);

    await page.getByRole("button", { name: "Do you want to see store locations?" }).click();
    await expect(page.getByRole("dialog", { name: "Store locations" })).toBeVisible();

    const storeList = page.locator(".nearby-stores-list");
    await expect(storeList.locator('[data-store-id="kroger-mechanicsville"]')).toBeVisible();
    await expect(storeList.locator('[data-store-id="aldi-mechanicsville"]')).toBeVisible();
    await expect(storeList.locator('[data-store-id="publix-1626"]')).toHaveCount(0);
    await expect(storeList.locator('[data-store-id="food-lion-mechanicsville"]')).toHaveCount(0);
  });

  test("lists selectable ranked-chain stores in Settings after market search", async ({
    page,
  }) => {
    await searchStoresFromZipWizard(page, E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "One store" }).click();
    await expect(
      page.getByRole("heading", { name: "Which stores should we use?" }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole("checkbox", { name: /Kroger/ }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Aldi/ }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Publix/ }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Food Lion/ }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Lidl/ }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Walmart/ }).first()).toBeVisible();
  });
});

test.describe("Settings validation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("shows ZIP validation error for invalid input", async ({ page }) => {
    await goToZipInput(page);
    await page.getByRole("textbox", { name: "ZIP code" }).fill("abc");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid 5-digit ZIP code.")).toBeVisible();
  });
});
