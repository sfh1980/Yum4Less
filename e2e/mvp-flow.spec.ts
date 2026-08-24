import { test, expect } from "@playwright/test";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  runCoreMvpFlow,
} from "./helpers";

// Fat Settings → map → pantry → rank path needs headroom beyond the default 90s
// so the dedicated 60s rank wait is not starved by earlier steps (Wave 1a).
test.describe("Yum4Less beta v1 (ZIP 23111)", () => {
  test.describe.configure({ timeout: 150_000 });

  test("finds nearby stores and ranks dinners with trust labels", async ({ page }) => {
    await runCoreMvpFlow(page);
  });

  test("expands stacked meal cards one at a time", async ({ page }) => {
    await runCoreMvpFlow(page);

    await expect(page.locator(".meal-results-accordion")).toBeVisible();

    const titleTriggers = page.locator(".meal-results-accordion-trigger");
    const triggerCount = await titleTriggers.count();
    expect(triggerCount).toBeGreaterThan(0);

    const firstTrigger = titleTriggers.first();
    if ((await firstTrigger.getAttribute("aria-expanded")) !== "true") {
      await firstTrigger.click();
    }
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".meal-results-accordion-panel")).toHaveCount(1);
    await expect(
      page.locator(".meal-results-accordion-panel .recommendation-card").first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save meal" })).toBeVisible();
    await page.getByRole("button", { name: "Save meal" }).click();
    await expect(page.locator(".meal-save-button")).toHaveText("Saved");

    if (triggerCount > 1) {
      const secondTrigger = titleTriggers.nth(1);
      await expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
      await secondTrigger.click();
      await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".meal-results-accordion-panel")).toHaveCount(1);
    }

    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Saved" }).click();
    await expect(
      page.getByText(/Totals are estimates from when you saved/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  });

  test("shows splash branding and a Feedback tab after results", async ({ page }) => {
    await page.goto("/");

    const splash = page.getByTestId("onboarding-splash");
    await expect(
      splash.or(page.getByRole("heading", { name: "Let’s get started" })),
    ).toBeVisible();
    if (await splash.isVisible()) {
      await expect(page.getByRole("heading", { name: "Yum4Less" })).toBeVisible();
      await expect(
        page.getByText(/Find realistic low-cost dinner options near you/i),
      ).toBeVisible();
      await expect(
        page.getByText(/dinner planner for grocery stores near you/i),
      ).toBeVisible();
      await expect(page.getByText(/Prices are estimates/i)).toBeVisible();
    }

    await runCoreMvpFlow(page);

    await expect(page.getByText(/Totals are estimates/i)).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Feedback" }).click();
    await expect(
      page.getByRole("heading", { name: "Send feedback or report a wrong price." }),
    ).toBeVisible();
  });

  test("keeps inline trust copy without the removed trust explainer modal", async ({
    page,
  }) => {
    await runCoreMvpFlow(page);

    await expect(
      page.getByRole("heading", { name: "How to read these results" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "How to read these labels" }),
    ).toHaveCount(0);
    await expect(page.getByText(/Totals are estimates/i)).toBeVisible();
    await expect(
      page.getByRole("note", { name: /heads up about these prices/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Where do these prices come from? Opens FAQ" }),
    ).toBeVisible();
  });

  test("opens a FAQ article from dinner results and restores dinners on Back", async ({
    page,
  }) => {
    await runCoreMvpFlow(page);

    await page
      .getByRole("link", { name: "Where do these prices come from? Opens FAQ" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Where do these prices come from?" }),
    ).toBeVisible();

    await page.goBack();
    await expect(page.locator(".meal-results-accordion")).toBeVisible({
      timeout: 15_000,
    });
  });
});
