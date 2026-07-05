import { test, expect } from "@playwright/test";
import {
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
  resetAppPreferences,
} from "./helpers";

test.describe("Settings store selection", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("scopes the map to the stores selected in Settings (ranked-chain subset)", async ({ page }) => {
    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Find stores for this area" }).click();
    await expect(page.getByRole("button", { name: "Save settings and continue" })).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByRole("combobox", { name: "Shopping style" })
      .selectOption("Multiple stores allowed");

    // Multi-store defaults to all ranked v1 chains once Publix/Food Lion are in radius.
    await page.getByRole("checkbox", { name: /Kroger — Mechanicsville/ }).check();
    await page.getByRole("checkbox", { name: /Aldi — Mechanicsville/ }).check();

    const publixCheckboxes = page.getByRole("checkbox", { name: /Publix —/ });
    for (let index = 0; index < await publixCheckboxes.count(); index += 1) {
      await publixCheckboxes.nth(index).uncheck();
    }

    const foodLionCheckboxes = page.getByRole("checkbox", { name: /Food Lion —/ });
    for (let index = 0; index < await foodLionCheckboxes.count(); index += 1) {
      await foodLionCheckboxes.nth(index).uncheck();
    }

    await page.getByRole("button", { name: "Save settings and continue" }).click();
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
    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Find stores for this area" }).click();
    await expect(page.getByRole("combobox", { name: "Store" })).toBeVisible({
      timeout: 30_000,
    });

    const storeSelect = page.getByRole("combobox", { name: "Store" });
    await expect(storeSelect).toContainText("Kroger");
    await expect(storeSelect).toContainText("Aldi");
    await expect(storeSelect).toContainText("Publix");
    await expect(storeSelect).toContainText("Food Lion");
  });
});

test.describe("Settings validation", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("shows ZIP validation error for invalid input", async ({ page }) => {
    await page.getByRole("textbox", { name: "ZIP code" }).fill("abc");
    await page.getByRole("button", { name: "Find stores for this area" }).click();
    await expect(page.getByText("Enter a valid 5-digit ZIP code.")).toBeVisible();
  });
});
