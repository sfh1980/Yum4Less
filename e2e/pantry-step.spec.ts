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

  test("always shows pantry step with continue enabled even when checklist is empty", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Use all \d+ sale ingredient/i }).click();
    await page.getByRole("button", { name: "Continue to pantry check" }).click();

    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
    await expect(page.getByText(/session only/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue to rank" }),
    ).toBeEnabled();
  });

  test("lets shoppers add a catalog pantry item and continue to rank", async ({ page }) => {
    await page.getByRole("button", { name: /Use all \d+ sale ingredient/i }).click();
    await page.getByRole("button", { name: "Continue to pantry check" }).click();
    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();

    await page.getByRole("combobox", { name: "Add a pantry item" }).fill("olive");
    await page.getByRole("option", { name: /Olive oil/i }).click();

    await expect(page.getByText("You added")).toBeVisible();
    await page.getByRole("button", { name: "Continue to rank" }).click();
    await expect(page.getByRole("heading", { name: "Rank dinners" })).toBeVisible();
  });
});
