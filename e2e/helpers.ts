import { expect, type Page } from "@playwright/test";

/** CI / E2E primary coordinate anchor (geolocation-first path). */
export const E2E_PRIMARY_COORDINATES = {
  latitude: 37.6085,
  longitude: -77.3739,
} as const;

/** ZIP fallback-path anchor only — not the primary geo fence. */
export const E2E_ZIP_FALLBACK = "23111";

export type PublicNearbyStore = {
  id: string;
  chain: string;
  recommendationEnabled: boolean;
  rolloutStatus: string;
  sourceStoreId?: string;
};

export type MarketSearchBody = {
  ok: boolean;
  market: {
    nearbyStores: PublicNearbyStore[];
  };
};

const PRODUCTION_RANKED_CHAINS = ["kroger", "aldi", "publix", "food-lion"] as const;

export async function resetAppPreferences(page: Page) {
  await page.goto("/");
  const factoryReset = page.getByRole("button", { name: "Factory reset preferences" });
  if (await factoryReset.isVisible()) {
    await factoryReset.click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  }
}

export async function completeSettingsZipFlow(
  page: Page,
  zipCode = E2E_ZIP_FALLBACK,
): Promise<MarketSearchBody> {
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByRole("textbox", { name: "ZIP code" }).fill(zipCode);
  const findStoresButton = page.getByRole("button", { name: "Find stores for this area" });
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/market-search") &&
        res.request().method() === "POST",
      { timeout: 120_000 },
    ),
    findStoresButton.click(),
  ]);
  expect(response.status(), "market-search should succeed for ZIP flow").toBe(200);
  const body = (await response.json()) as MarketSearchBody;
  expect(body.ok).toBe(true);
  assertPublicNearbyStoresSanitized(body.market.nearbyStores);
  assertProductionRankedRolloutGates(body.market.nearbyStores);
  await page.getByRole("button", { name: "Save settings and continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  return body;
}

export async function completeSettingsGeolocationFlow(page: Page): Promise<MarketSearchBody> {
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const useLocationButton = page.getByRole("button", { name: "Use my location" });
  await expect(useLocationButton).toBeEnabled({ timeout: 120_000 });
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/market-search") &&
        res.request().method() === "POST",
      { timeout: 120_000 },
    ),
    useLocationButton.click(),
  ]);
  expect(response.status(), "market-search should succeed for geolocation flow").toBe(200);
  const requestBody = response.request().postDataJSON() as {
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  expect(requestBody.latitude).toBeCloseTo(E2E_PRIMARY_COORDINATES.latitude, 2);
  expect(requestBody.longitude).toBeCloseTo(E2E_PRIMARY_COORDINATES.longitude, 2);
  const body = (await response.json()) as MarketSearchBody;
  expect(body.ok).toBe(true);
  await page.getByRole("button", { name: "Save settings and continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  return body;
}

export async function completeWelcomeFlow(page: Page) {
  await page.getByRole("button", { name: "Continue to ingredients" }).click();
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
}

export async function pickAllIngredientsAndContinue(page: Page) {
  await page.getByRole("button", { name: /Use all \d+ sale ingredient/i }).click();
  await page.getByRole("button", { name: "Continue to rank" }).click();
  await expect(page.getByRole("heading", { name: "Rank dinners" })).toBeVisible();
}

export async function goToRankStep(page: Page) {
  const useAllButton = page.getByRole("button", { name: /Use all \d+ sale ingredient/i });
  if (await useAllButton.isVisible()) {
    await useAllButton.click();
  }
  await page.getByRole("button", { name: "Continue to rank" }).click();
  await expect(page.getByRole("heading", { name: "Rank dinners" })).toBeVisible();
}

export async function openMapOverlay(page: Page) {
  await page.getByRole("button", { name: "Do you want to see store locations?" }).click();
  await expect(page.getByRole("dialog", { name: "Store locations" })).toBeVisible();
}

export async function closeMapOverlay(page: Page) {
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Store locations" })).toHaveCount(0);
}

export async function switchMainTab(page: Page, tab: "Home" | "Deals" | "Cook" | "Saved" | "Settings") {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: tab })
    .click();
}

export function assertPublicNearbyStoresSanitized(stores: PublicNearbyStore[]) {
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

export function assertProductionRankedRolloutGates(stores: PublicNearbyStore[]) {
  const rankedStores = stores.filter((store) => store.recommendationEnabled);
  expect(
    rankedStores.length,
    "expected at least one recommendation-enabled store in fixture market",
  ).toBeGreaterThanOrEqual(1);

  const kroger = findRankedStoreByChain(stores, "kroger");
  expect(kroger, "23111 fixture should include ranked Kroger").toBeTruthy();

  for (const store of rankedStores) {
    expect(store.rolloutStatus).not.toBe("coming-soon");
  }

  for (const store of stores) {
    if (store.chain === "walmart") {
      expect(store.recommendationEnabled).toBe(false);
      expect(store.rolloutStatus).toBe("coming-soon");
    }
  }
}

export async function assertMarketSearchStoreResults(
  page: Page,
  stores: PublicNearbyStore[],
) {
  await openMapOverlay(page);
  await expect(page.getByRole("heading", { name: "Nearby stores map" })).toBeVisible();

  const storePanel = page.locator(".map-discovery-layout, .nearby-stores-list");
  const krogerRanked = findRankedStoreByChain(stores, "kroger");
  expect(krogerRanked).toBeTruthy();

  const krogerStoreCard = storePanel.locator(`[data-store-id="${krogerRanked!.id}"]`);
  await expect(krogerStoreCard).toBeVisible({ timeout: 30_000 });
  await expect(
    krogerStoreCard.getByText(/Est\. (?:sale|store) prices/i),
  ).toBeVisible();

  for (const chain of PRODUCTION_RANKED_CHAINS) {
    const ranked = findRankedStoreByChain(stores, chain);
    if (!ranked) {
      continue;
    }

    const storeCard = storePanel.locator(`[data-store-id="${ranked.id}"]`);
    if ((await storeCard.count()) === 0) {
      continue;
    }

    await expect(storeCard).toBeVisible();
    await expect(
      storeCard.getByText(/Est\. (?:sale|store) prices/i),
    ).toBeVisible();
  }

  await closeMapOverlay(page);
}

export async function assertWalmartContextOnlyOnMap(
  page: Page,
  stores: PublicNearbyStore[],
) {
  const walmart = stores.find((store) => store.chain === "walmart");
  if (!walmart) {
    return;
  }

  expect(walmart.recommendationEnabled).toBe(false);
  expect(walmart.rolloutStatus).toBe("coming-soon");

  await openMapOverlay(page);
  const storePanel = page.locator(".map-discovery-layout");
  const walmartCard = storePanel.locator(`[data-store-id="${walmart.id}"]`);

  if ((await walmartCard.count()) > 0) {
    await expect(
      walmartCard.getByText(/Context only|no pricing yet|coming soon/i),
    ).toBeVisible();
  } else {
    // Map list is scoped to Settings-selected ranked stores; Walmart is context-only and not selectable.
    await expect(
      storePanel.getByText(/Gray badges.*context only/i),
    ).toBeVisible();
  }

  await closeMapOverlay(page);
}

export async function runCoreMvpFlow(page: Page) {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Find realistic low-cost dinner options near you/i,
    }),
  ).toBeVisible();

  const marketBody = await completeSettingsZipFlow(page);
  await completeWelcomeFlow(page);
  await assertMarketSearchStoreResults(page, marketBody.market.nearbyStores);
  await assertWalmartContextOnlyOnMap(page, marketBody.market.nearbyStores);

  await expect(page.getByText(/^Priced$/i)).toHaveCount(0);

  const ingredientGate = page.getByRole("button", { name: /Use all \d+ sale ingredient/i });
  await expect(ingredientGate).toBeVisible({ timeout: 30_000 });

  await goToRankStep(page);

  const suggestButton = page.getByRole("button", {
    name: "Suggest recipes for my store(s)",
  });
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
  assertPublicNearbyStoresSanitized(
    recommendationsBody.experience.market.nearbyStores,
  );
  assertProductionRankedRolloutGates(
    recommendationsBody.experience.market.nearbyStores,
  );

  await expect(
    page.getByRole("heading", { name: "How to read these results" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "How to read these labels" }),
  ).toHaveCount(0);

  const firstMealTrigger = page.locator(".meal-results-accordion-trigger").first();
  await expect(firstMealTrigger).toBeVisible();
  await expect(firstMealTrigger).toHaveAttribute("aria-expanded", "false");
  await firstMealTrigger.click();
  await expect(firstMealTrigger).toHaveAttribute("aria-expanded", "true");

  const expandedPanel = page.locator(".meal-results-accordion-panel").first();
  await expect(expandedPanel.getByText(/Est\. \$\d+\.\d{2}/).first()).toBeVisible();
  await expect(
    page
      .getByText(
        /Dinner totals below use (?:saved sale prices|recently checked online (?:store )?prices plus saved sale prices)/i,
      )
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        /(?:Limited )?(?:saved sale prices|recently checked online prices and saved sale prices) at .+ — not live checkout; confirm in store\./i,
      )
      .first(),
  ).toBeVisible();
  await expect(
    expandedPanel
      .locator(".sale-confidence-label")
      .filter({ hasText: /Sale price — estimate only|estimate only/i })
      .first(),
  ).toBeVisible();
  const headsUpNote = page
    .getByRole("note", { name: /heads up about these prices/i })
    .first();
  await expect(headsUpNote).toBeVisible();
  await expect(headsUpNote).toContainText(
    /saved store prices from ads and online checks|Treat totals as estimates/i,
  );
  await expect(page.getByText(/Treat totals as estimates/i).first()).toBeVisible();
  await expect(
    page.locator(".meal-card-price-age, .sale-ingredient-freshness").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Project & data details (internal)" }),
  ).toHaveCount(0);
}
