import { test, expect } from "@playwright/test";
import { runCoreMvpFlow, seedZipSearchCenterFromGeocode } from "./helpers";

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
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".meal-results-accordion-panel")).toHaveCount(1);
    await expect(
      page.locator(".meal-results-accordion-panel .recommendation-card").first(),
    ).toBeVisible();

    if (triggerCount > 1) {
      const secondTrigger = titleTriggers.nth(1);
      await expect(secondTrigger).toHaveAttribute("aria-expanded", "false");
      await secondTrigger.click();
      await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".meal-results-accordion-panel")).toHaveCount(1);
    }
  });

  test("shows beta label and footer feedback link", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".hero .eyebrow")).toHaveText("Yum4Less");
    await expect(
      page.getByRole("link", { name: "Send feedback or report a wrong price" }),
    ).toHaveAttribute("href", "/feedback");

    await runCoreMvpFlow(page);

    await expect(page.getByText(/Totals are estimates/i)).toBeVisible();
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
      page.getByRole("note", { name: /heads up about these prices/i }).first(),
    ).toBeVisible();
  });

  test("expands pricing trust disclosure on the map", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "ZIP code" }).fill("23111");
    await seedZipSearchCenterFromGeocode(page, "23111");
    await page.getByRole("button", { name: "Find stores based on my ZIP" }).click();
    await page.getByRole("button", { name: "Save settings and continue" }).click();
    await page.getByRole("button", { name: "Continue to ingredients" }).click();
    await page.getByRole("button", { name: "Do you want to see store locations?" }).click();

    const expandSummary = page.getByText("More about these estimates").first();
    await expandSummary.click();
    await expect(page.getByText(/Kroger-family|weekly.ad|directional/i).first()).toBeVisible();
  });
});
