import { test, expect } from "@playwright/test";
import {
  completeSettingsZipFlow,
  completeWelcomeFlow,
  goToPantryStep,
  resetAppPreferences,
  switchMainTab,
} from "./helpers";

test.describe("Market pass-through (Q123 / M123)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("sends trimmed market snapshot on rank and keeps Deals data after rank", async ({
    page,
  }) => {
    const marketBody = await completeSettingsZipFlow(page);
    const storeIdsBefore = marketBody.market.nearbyStores.map((store) => store.id);

    await completeWelcomeFlow(page);
    await goToPantryStep(page);

    let recommendationsPayload: { market?: { nearbyStores?: { id: string }[] } } | null =
      null;
    await page.route("**/api/recommendations", async (route) => {
      if (route.request().method() === "POST") {
        recommendationsPayload = route.request().postDataJSON() as {
          market?: { nearbyStores?: { id: string }[] };
        };
      }
      await route.continue();
    });

    const recommendationsResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/recommendations") &&
        res.request().method() === "POST" &&
        res.status() === 200,
    );
    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    await recommendationsResponse;

    expect(recommendationsPayload).not.toBeNull();
    const passedStoreIds =
      recommendationsPayload!.market?.nearbyStores?.map((store) => store.id) ?? [];
    expect(passedStoreIds.length).toBeGreaterThan(0);
    for (const id of passedStoreIds) {
      expect(storeIdsBefore).toContain(id);
    }

    await switchMainTab(page, "Deals");
    await expect(page.getByRole("heading", { name: "Deals" })).toBeVisible();
    await expect(page.locator(".deals-list-item").first()).toBeVisible();
    await expect(page.getByText(/estimated|directional/i).first()).toBeVisible();
  });
});
