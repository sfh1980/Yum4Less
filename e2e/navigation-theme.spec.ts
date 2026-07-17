import { test, expect } from "@playwright/test";
import {
  completePantryAndSuggestRecipes,
  completeSettingsZipFlow,
  completeWelcomeFlow,
  E2E_ZIP_FALLBACK,
  resetAppPreferences,
  switchMainTab,
} from "./helpers";

test.describe("Bottom navigation and theme", () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("disables Home/Deals/Saved until Settings setup is complete", async ({
    page,
  }) => {
    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(mainNav.getByRole("button", { name: "Settings" })).toBeEnabled();
    await expect(mainNav.getByRole("button", { name: "Home" })).toBeDisabled();
    await expect(mainNav.getByRole("button", { name: "Deals" })).toBeDisabled();
    await expect(mainNav.getByRole("button", { name: "Saved" })).toBeDisabled();
    await expect(mainNav.getByRole("button", { name: "Cook" })).toBeDisabled();
  });

  test("routes across main tabs and disables Cook until recipes exist", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);

    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(mainNav.getByRole("button", { name: "Cook" })).toBeDisabled();

    await switchMainTab(page, "Deals");
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();

    await switchMainTab(page, "Saved");
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();

    await switchMainTab(page, "Settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await switchMainTab(page, "Home");
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  });

  test("enables Cook tab after ranked recipes are ready", async ({ page }) => {
    await resetAppPreferences(page);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.getByRole("textbox", { name: "ZIP code" }).fill(E2E_ZIP_FALLBACK);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/market-search") &&
          res.request().method() === "POST",
        { timeout: 120_000 },
      ),
      page.getByRole("button", { name: "Find stores for this area" }).click(),
    ]);
    expect(response.status()).toBe(200);
    const marketBody = (await response.json()) as {
      market: { nearbyStores: Array<{ id: string; chain: string; recommendationEnabled: boolean }> };
    };
    const kroger = marketBody.market.nearbyStores.find(
      (store) => store.chain === "kroger" && store.recommendationEnabled,
    );
    expect(kroger, "23111 fixture should include ranked Kroger for Cook tab gate").toBeTruthy();
    await page.getByRole("combobox", { name: "Store" }).selectOption(kroger!.id);
    await page.getByRole("button", { name: "Save settings and continue" }).click();
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();

    await completeWelcomeFlow(page);
    await completePantryAndSuggestRecipes(page);

    const cookButton = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Cook" });
    await expect(cookButton).toBeEnabled({ timeout: 30_000 });
    await cookButton.click();
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible();
  });

  test("applies dark theme from Settings", async ({ page }) => {
    await page.getByRole("combobox", { name: "Theme" }).selectOption("Dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("combobox", { name: "Theme" }).selectOption("Light");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
