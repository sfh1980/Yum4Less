import { test, expect } from "@playwright/test";
import {
  completeSettingsGeolocationFlow,
  completeWelcomeFlow,
  E2E_PRIMARY_COORDINATES,
  resetAppPreferences,
  SETTINGS_PREFERENCES_STORAGE_KEY,
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

  test("completes Settings on geolocation alone without persisting exact coordinates", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.locator("#settings-zip-code").fill("");

    const useLocationButton = page.getByRole("button", { name: "Use my location" });
    await expect(useLocationButton).toBeEnabled({ timeout: 120_000 });
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/market-search") &&
          res.request().method() === "POST",
        { timeout: 120_000 },
      ),
      useLocationButton.click(),
    ]);
    expect(response.status()).toBe(200);

    await page.getByRole("button", { name: "Save settings and continue" }).click();
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();

    const stored = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    }, SETTINGS_PREFERENCES_STORAGE_KEY);

    expect(stored).toBeTruthy();
    expect(stored?.setupComplete).toBe(true);
    expect(stored?.locationMode).toBe("geolocation");
    expect(stored?.latitude).toBeUndefined();
    expect(stored?.longitude).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(stored, "latitude")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(stored, "longitude")).toBe(false);
  });
});
