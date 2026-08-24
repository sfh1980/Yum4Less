import { test, expect } from "@playwright/test";
import { E2E_ZIP_FALLBACK, resetAppPreferences } from "./helpers";

test.describe("GPS deny falls back to ZIP", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearPermissions();
    await resetAppPreferences(page);
  });

  test("shows a GPS unavailable message and continues on the ZIP path", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Use GPS" }).click();
    await expect(
      page.getByText("GPS isn't available. Continue with a ZIP code and place a pin on the map."),
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Enter your ZIP code" })).toBeVisible();
    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Place your pin" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "How far should we look?" })).toBeVisible();
  });
});
