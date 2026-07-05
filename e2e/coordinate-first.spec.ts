import { test, expect } from "@playwright/test";
import {
  completeSettingsGeolocationFlow,
  completeWelcomeFlow,
  E2E_PRIMARY_COORDINATES,
  resetAppPreferences,
} from "./helpers";

test.describe("Coordinate-first location (primary anchor)", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(E2E_PRIMARY_COORDINATES);
    await resetAppPreferences(page);
  });

  test("searches by browser geolocation and reaches ingredients", async ({ page }) => {
    await completeSettingsGeolocationFlow(page);
    await completeWelcomeFlow(page);

    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
    await expect(
      page.getByText(/No sale ingredients are available/i),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Do you want to see store locations?" }).click();
    await expect(page.getByRole("heading", { name: "Nearby stores map" })).toBeVisible();
    await expect(page.getByText(/Est\. (?:sale|store) prices/i).first()).toBeVisible();
  });
});
