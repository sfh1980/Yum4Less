import { test, expect } from "@playwright/test";
import {
  completeWelcomeFlow,
  goToPantryStep,
  injectStaleSelectedStoreIds,
  readPersistedSelectedStoreIds,
  resetAppPreferences,
  searchStoresFromZipWizard,
} from "./helpers";

const STALE_STORE_ID = "aldi-23111";

async function completeSettingsZipFlowMultiStore(page: import("@playwright/test").Page) {
  await searchStoresFromZipWizard(page);
  await page.getByRole("button", { name: "Several stores" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "How much do you want to spend?" }),
  ).toBeVisible();
}

test.describe("Stale store selection re-sync (#14–15)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAppPreferences(page);
  });

  test("drops stale store ids on rank, shows notice, and writes back effective selection", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await completeSettingsZipFlowMultiStore(page);
    await completeWelcomeFlow(page);
    await goToPantryStep(page);

    // Simulate stale localStorage surviving until rank (market-search prune may run earlier on reload).
    await injectStaleSelectedStoreIds(page, [STALE_STORE_ID]);

    await page.route("**/api/recommendations", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      const body = route.request().postDataJSON() as { selectedStoreIds?: string[] };
      await route.continue({
        postData: JSON.stringify({
          ...body,
          selectedStoreIds: [...(body.selectedStoreIds ?? []), STALE_STORE_ID],
        }),
      });
    });

    const recommendationsResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/recommendations") &&
        res.request().method() === "POST" &&
        res.status() === 200,
    );
    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    const response = await recommendationsResponse;
    const body = (await response.json()) as {
      ok: boolean;
      experience?: {
        effectiveSelectedStoreIds?: string[];
        supplementaryShopperNotices?: Array<{ title: string }>;
      };
    };

    expect(body.ok).toBe(true);
    expect(
      body.experience?.supplementaryShopperNotices?.some((notice) =>
        notice.title.includes("Store selection updated"),
      ),
    ).toBe(true);
    await expect(page.getByText("Store selection updated")).toBeVisible();

    const storedIds = await readPersistedSelectedStoreIds(page);
    expect(storedIds).not.toContain(STALE_STORE_ID);
    expect(body.experience?.effectiveSelectedStoreIds ?? storedIds).not.toContain(STALE_STORE_ID);

    await page.unroute("**/api/recommendations");
    // Auto market-search fires on hydrate as soon as Home/Welcome mounts — register
    // before reload so we cannot miss a fast response (classic waitForResponse race).
    const marketSearchAfterReload = page.waitForResponse(
      (res) =>
        res.url().includes("/api/market-search") &&
        res.request().method() === "POST",
      { timeout: 120_000 },
    );
    await page.reload();
    const marketResponse = await marketSearchAfterReload;
    expect(marketResponse.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "How much do you want to spend?" }),
    ).toBeVisible({
      timeout: 30_000,
    });
    await completeWelcomeFlow(page);
    await goToPantryStep(page);

    const secondRankResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/recommendations") &&
        res.request().method() === "POST" &&
        res.status() === 200,
    );
    await page.getByRole("button", { name: "Suggest recipes for my store(s)" }).click();
    const secondBody = (await (await secondRankResponse).json()) as {
      experience?: { supplementaryShopperNotices?: Array<{ title: string }> };
    };

    expect(
      secondBody.experience?.supplementaryShopperNotices?.some((notice) =>
        notice.title.includes("Store selection updated"),
      ) ?? false,
    ).toBe(false);
    await expect(page.getByText("Store selection updated")).toHaveCount(0);
  });
});
