import { expect, test } from "@playwright/test";
import {
  completeSettingsZipFlow,
  resetAppPreferences,
  switchMainTab,
} from "./helpers";
import { RESET_PREFERENCES_BUTTON_LABEL } from "@/lib/reset-preferences-copy";

test.describe("FAQ and Terms pages", () => {
  test("lists question titles and opens an article", async ({ page }) => {
    await page.goto("/faq");
    await expect(
      page.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Why are dinner totals only estimates?" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Why are dinner totals only estimates?" }),
    ).toBeVisible();
    await expect(page.getByText(/not a checkout total/i)).toBeVisible();
  });

  test("renders the short beta terms page without requiring a Terms link on FAQ", async ({
    page,
  }) => {
    await page.goto("/faq");
    await expect(page.getByRole("link", { name: "Terms of use" })).toHaveCount(0);

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();
    await expect(page.getByText(/not a checkout, coupon, or price-guarantee/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Frequently asked questions" })).toBeVisible();
  });

  test.describe("in-app legal links", () => {
    test.describe.configure({ timeout: 150_000 });

    test.beforeEach(async ({ page }) => {
      await resetAppPreferences(page);
    });

    test("shows FAQ and Terms on Settings and Feedback after setup", async ({ page }) => {
      await completeSettingsZipFlow(page);

      await switchMainTab(page, "Settings");
      await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();
      await expect(page.getByRole("link", { name: "FAQ" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Terms of use" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: RESET_PREFERENCES_BUTTON_LABEL }),
      ).toBeVisible();

      await switchMainTab(page, "Feedback");
      await expect(
        page.getByRole("heading", { name: "Send feedback or report a wrong price." }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "FAQ" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Terms of use" })).toBeVisible();
    });

    test("Back from Terms keeps light theme and returns to Settings", async ({ page }) => {
      await completeSettingsZipFlow(page);
      await switchMainTab(page, "Settings");
      await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();

      await page.getByRole("button", { name: "Switch to dark theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.getByRole("button", { name: "Switch to light theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

      await page.getByRole("link", { name: "Terms of use" }).click();
      await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

      await page.getByRole("link", { name: "Back to meal planner" }).click();
      await expect(page.getByTestId("onboarding-splash")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Let’s get started" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await expect(
        page.getByRole("button", { name: RESET_PREFERENCES_BUTTON_LABEL }),
      ).toBeVisible();

      await switchMainTab(page, "Home");
      await expect(
        page.getByRole("heading", { name: "How much do you want to spend?" }),
      ).toBeVisible();
    });
  });
});
