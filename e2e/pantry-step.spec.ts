import { expect, test } from "@playwright/test";
import {
  completeSettingsGeolocationFlow,
  completeWelcomeFlow,
  E2E_PRIMARY_COORDINATES,
  resetAppPreferences,
} from "./helpers";

test.describe("Pantry check step", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({
      latitude: E2E_PRIMARY_COORDINATES.latitude,
      longitude: E2E_PRIMARY_COORDINATES.longitude,
    });
    await resetAppPreferences(page);
    await completeSettingsGeolocationFlow(page);
    await completeWelcomeFlow(page);
  });

  test("always shows suggest recipes enabled when ranking is available", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Use everything on sale" }).click();

    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
    await expect(page.getByText(/session only/i)).toBeVisible();
    await expect(page.getByText(/dinners can be shown next/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Suggest recipes for my store(s)" }),
    ).toBeEnabled();
  });

  test("lets shoppers check a suggested pantry item and suggest recipes", async ({ page }) => {
    await page.getByRole("button", { name: "Use everything on sale" }).click();
    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Add a pantry item" })).toHaveCount(0);

    const firstSuggested = page.locator(".pantry-checklist input[type=checkbox]").first();
    if ((await firstSuggested.count()) > 0) {
      await firstSuggested.check();
      await expect(firstSuggested).toBeChecked();
    }

    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
