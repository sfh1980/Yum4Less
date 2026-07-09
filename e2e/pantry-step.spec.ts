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
    await page.getByRole("button", { name: "Use all ingredients and check pantry" }).click();

    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
    await expect(page.getByText(/session only/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Suggest recipes for my store(s)" }),
    ).toBeEnabled();
  });

  test("lets shoppers add a catalog pantry item and suggest recipes", async ({ page }) => {
    await page.getByRole("button", { name: "Use all ingredients and check pantry" }).click();
    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();

    await page.getByRole("combobox", { name: "Add a pantry item" }).fill("olive");
    await page.getByRole("option", { name: /Olive oil/i }).click();

    await page
      .getByRole("button", { name: /Your pantry for this session \(\d+ items?\)/i })
      .click();
    await expect(page.getByText("You added")).toBeVisible();
    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
