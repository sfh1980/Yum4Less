import { test, expect, type Page } from "@playwright/test";

type PublicNearbyStore = {
  id: string;
  chain: string;
  recommendationEnabled: boolean;
  rolloutStatus: string;
  sourceStoreId?: string;
};

type MarketSearchResponse = {
  ok: boolean;
  market: {
    nearbyStores: PublicNearbyStore[];
  };
};

/**
 * H3 E2E assertion rules (audit 2026-06-13, updated Phase 3):
 *
 * - STORES: Assert ranked Kroger-family + Aldi by chain + recommendationEnabled
 *   (not hard-coded bootstrap slugs). CI may use seed catalog ids; owner ingest uses API ids.
 *
 * - CHAINS: Never use page-wide /Kroger|Publix|Food Lion/i — hero and Step 1 marketing copy
 *   mention those chains before /api/market-search returns, causing false positives.
 *
 * - INGREDIENTS: Use structural/role checks (.sale-ingredient-list checkboxes, Step 3 heading,
 *   disabled→enabled Suggest CTA). Do NOT assert catalog ingredient names — the priced set
 *   comes from ingested observations and will change as sync breadth grows.
 */
async function submitZipMarketSearch(page: Page, zipCode = "23111") {
  await page.getByRole("textbox", { name: "ZIP code" }).fill(zipCode);
  const marketSearchResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/market-search") &&
      res.request().method() === "POST" &&
      res.status() === 200,
  );
  await page.getByRole("button", { name: "Find nearby stores" }).click();
  const response = await marketSearchResponse;
  const body = (await response.json()) as MarketSearchResponse;
  expect(body.ok).toBe(true);
  assertPublicNearbyStoresSanitized(body.market.nearbyStores);
  assertProductionRankedRolloutGates(body.market.nearbyStores);
  return body;
}

function assertPublicNearbyStoresSanitized(stores: PublicNearbyStore[]) {
  for (const store of stores) {
    expect(store, `store ${store.id} must omit sourceStoreId`).not.toHaveProperty(
      "sourceStoreId",
    );
  }
}

function findRankedStoreByChain(stores: PublicNearbyStore[], chain: string) {
  return stores.find(
    (store) => store.chain === chain && store.recommendationEnabled,
  );
}

function assertProductionRankedRolloutGates(stores: PublicNearbyStore[]) {
  const krogerRanked = findRankedStoreByChain(stores, "kroger");
  expect(krogerRanked, "expected a ranked Kroger-family store").toBeTruthy();

  const aldiRanked = findRankedStoreByChain(stores, "aldi");
  expect(aldiRanked, "expected a ranked Aldi store").toBeTruthy();

  for (const store of stores) {
    if (store.chain === "publix" || store.chain === "food-lion") {
      expect(store.recommendationEnabled).toBe(false);
      expect(store.rolloutStatus).toBe("coming-soon");
    }
  }
}

async function assertMarketSearchStoreResults(page: Page, stores: PublicNearbyStore[]) {
  await expect(page.getByRole("heading", { name: "Location set" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nearby stores map" })).toBeVisible();

  const storePanel = page.locator(".map-discovery-layout, .nearby-stores-list");
  const krogerRanked = findRankedStoreByChain(stores, "kroger");
  expect(krogerRanked).toBeTruthy();

  const krogerStoreCard = storePanel.locator(
    `[data-store-id="${krogerRanked!.id}"]`,
  );
  await expect(krogerStoreCard).toBeVisible();
  await expect(
    krogerStoreCard.getByText(/Est\. (?:weekly-ad|Kroger API) prices/i),
  ).toBeVisible();

  for (const store of stores) {
    if (store.chain !== "publix" && store.chain !== "food-lion") {
      continue;
    }

    const contextStore = storePanel.locator(`[data-store-id="${store.id}"]`);
    if ((await contextStore.count()) > 0) {
      await expect(
        contextStore.getByText(/Context only|coming soon|upcoming release/i),
      ).toBeVisible();
      await expect(contextStore.getByText(/^Est\. weekly-ad prices$/i)).toHaveCount(0);
    }
  }
}

async function runCoreMvpFlow(page: Page) {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Find realistic low-cost dinner options near you/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Step 1: Find nearby stores" }),
  ).toBeVisible();

  const marketBody = await submitZipMarketSearch(page);
  await assertMarketSearchStoreResults(page, marketBody.market.nearbyStores);

  await expect(
    page
      .getByText(
        /Context only — no Walmart pricing|Walmart always context-only|Live, current weekly-ad pricing from Walmart is not available/i,
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/Est\. weekly-ad prices/i).first()).toBeVisible();
  await expect(page.getByText(/^Priced$/i)).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "Step 3: Browse nearby sale ingredients" }),
  ).toBeVisible();

  const suggestButton = page.getByRole("button", {
    name: "Suggest recipes using my selected ingredients",
  });
  await expect(suggestButton).toBeDisabled();
  await expect(
    page.getByText(/Select at least one sale ingredient, then use Suggest recipes/i),
  ).toBeVisible();

  const ingredientList = page.locator(".sale-ingredient-list");
  const ingredientCheckboxes = ingredientList.getByRole("checkbox");
  await expect(ingredientCheckboxes.first()).toBeVisible({ timeout: 30_000 });
  expect(await ingredientCheckboxes.count()).toBeGreaterThan(0);

  await ingredientCheckboxes.first().check();
  await expect(suggestButton).not.toBeDisabled();

  const recommendationsResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/recommendations") &&
      res.request().method() === "POST" &&
      res.status() === 200,
  );
  await suggestButton.click();
  const recommendationsBody = (await (await recommendationsResponse).json()) as {
    ok: boolean;
    experience: { market: { nearbyStores: PublicNearbyStore[] } };
  };
  expect(recommendationsBody.ok).toBe(true);
  assertPublicNearbyStoresSanitized(recommendationsBody.experience.market.nearbyStores);
  assertProductionRankedRolloutGates(recommendationsBody.experience.market.nearbyStores);

  await expect(
    page.getByRole("heading", { name: "How to read these results" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(
    page.getByRole("heading", { name: "How to read these results" }),
  ).not.toBeVisible();

  await expect(page.getByText(/Est\. \$\d+\.\d{2}/).first()).toBeVisible();
  await expect(
    page
      .getByText(
        /Ranked meal totals below use (?:saved weekly-ad prices|recently checked online (?:store )?prices plus saved weekly ads)/i,
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        /(?:Directional )?(?:saved weekly-ad prices|recently checked online prices and saved weekly ads) at .+ — not live checkout; confirm in store\./i,
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/weekly-ad price — directional|directional|estimated/i)
      .first(),
  ).toBeVisible();
  const headsUpNote = page.getByRole("note", { name: /heads up about these prices/i }).first();
  await expect(headsUpNote).toBeVisible();
  await expect(headsUpNote).toContainText(
    /saved weekly ads and recently checked online store prices|Treat totals as estimates/i,
  );
  await expect(page.getByText(/Treat totals as estimates/i).first()).toBeVisible();
  await expect(
    page.locator(".meal-card-price-age, .sale-ingredient-freshness").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Project & data details (internal)" }),
  ).toHaveCount(0);
}

test.describe("Yum4Less beta v1 (ZIP 23111)", () => {
  test("finds nearby stores and ranks dinners with trust labels", async ({ page }) => {
    await runCoreMvpFlow(page);
  });

  test("shows swipe carousel controls for multiple ranked dinners", async ({ page }) => {
    await runCoreMvpFlow(page);

    const carouselHint = page.getByText(/Swipe sideways or use the arrows/i);
    const nextButton = page.getByRole("button", { name: "Next recommendation" });

    if (await carouselHint.isVisible()) {
      await expect(page.getByText(/1 of \d+/)).toBeVisible();

      const pagination = page.locator('[aria-label="Recommendation pagination"]');
      await expect(pagination).toBeVisible();
      const dotButtons = pagination.getByRole("button");
      await expect(dotButtons.first()).toBeVisible();
      expect(await dotButtons.count()).toBeGreaterThan(1);

      const secondDot = page.getByRole("button", { name: "Show recommendation 2" });
      await expect(secondDot).toBeVisible();
      await secondDot.click();
      await expect(page.getByText(/2 of \d+/)).toBeVisible();

      await page.getByRole("button", { name: "Previous recommendation" }).click();
      await expect(page.getByText(/1 of \d+/)).toBeVisible();
      await nextButton.click();
      await expect(page.getByText(/2 of \d+/)).toBeVisible();
    }
  });

  test("shows beta label and footer feedback link", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/Yum4Less · Beta v1/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Send feedback or report a wrong price" }),
    ).toHaveAttribute("href", "/feedback");

    await runCoreMvpFlow(page);

    await expect(page.getByText(/Beta v1: totals are estimates/i)).toBeVisible();
  });

  test("opens the trust explainer from the results panel", async ({ page }) => {
    await page.goto("/");
    const marketBody = await submitZipMarketSearch(page);

    await expect(page.getByRole("heading", { name: "Location set" })).toBeVisible();
    const storePanel = page.locator(".map-discovery-layout, .nearby-stores-list");
    const krogerRanked = findRankedStoreByChain(marketBody.market.nearbyStores, "kroger");
    expect(krogerRanked).toBeTruthy();
    await expect(
      storePanel.locator(`[data-store-id="${krogerRanked!.id}"]`),
    ).toBeVisible();

    await page.getByRole("button", { name: "How to read these labels" }).click();
    const trustDialog = page.getByRole("dialog");
    await expect(
      trustDialog.getByRole("heading", { name: "How to read these results" }),
    ).toBeVisible();
    await expect(trustDialog.getByText(/helpful estimates/i)).toBeVisible();
    await expect(trustDialog.getByText(/Beta v1/i)).toBeVisible();
    await expect(trustDialog.getByText(/not part of the current production release/i)).toBeVisible();
    await expect(
      trustDialog.getByText(/Kroger family and Aldi \(production focus\)/i),
    ).toBeVisible();
  });
});
