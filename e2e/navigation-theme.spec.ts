import { test, expect } from "@playwright/test";
import {
  completePantryAndSuggestRecipes,
  completeSettingsZipFlow,
  completeWelcomeFlow,
  resetAppPreferences,
  searchStoresFromZipWizard,
  switchMainTab,
} from "./helpers";

test.describe("Bottom navigation and theme", () => {
  test.describe.configure({ timeout: 150_000 });

  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("lets locked tabs open a remaining-steps message before setup is complete", async ({
    page,
  }) => {
    const mainNav = page.getByRole("navigation", { name: "Main" });
    await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();
    await expect(mainNav.getByRole("button", { name: "Settings" })).toBeEnabled();
    await expect(mainNav.getByRole("button", { name: "Home" })).toBeEnabled();
    await expect(mainNav.getByRole("button", { name: "Feedback" })).toBeEnabled();

    await switchMainTab(page, "Home");
    await expect(page.getByText("4 steps needed before this works")).toBeVisible();

    await switchMainTab(page, "Feedback");
    await expect(
      page.getByRole("heading", { name: "Send feedback or report a wrong price." }),
    ).toBeVisible();
  });

  test("routes across main tabs and keeps Cook gated until recipes exist", async ({ page }) => {
    await completeSettingsZipFlow(page);
    await completeWelcomeFlow(page);

    await switchMainTab(page, "Cook");
    await expect(page.getByText("Suggest recipes on Home first")).toBeVisible();

    await switchMainTab(page, "Deals");
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();

    await switchMainTab(page, "Saved");
    await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();

    await switchMainTab(page, "Settings");
    await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();

    await switchMainTab(page, "Home");
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  });

  test("enables Cook tab after ranked recipes are ready", async ({ page }) => {
    await resetAppPreferences(page);
    const response = await searchStoresFromZipWizard(page);
    const marketBody = (await response.json()) as {
      market: { nearbyStores: Array<{ id: string; chain: string; recommendationEnabled: boolean }> };
    };
    const kroger = marketBody.market.nearbyStores.find(
      (store) => store.chain === "kroger" && store.recommendationEnabled,
    );
    expect(kroger, "23111 fixture should include ranked Kroger for Cook tab gate").toBeTruthy();
    await page.getByRole("button", { name: "One store" }).click();
    await page.locator(`#wizard-store-${kroger!.id}`).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "How much do you want to spend?" }),
    ).toBeVisible();

    await completeWelcomeFlow(page);
    await completePantryAndSuggestRecipes(page);

    const cookButton = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Cook" });
    await cookButton.click();
    await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible();
  });

  test("applies dark theme from the chrome toggle", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});
