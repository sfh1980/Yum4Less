import { expect, type Page, type Response } from "@playwright/test";
import {
  assertRecommendationsHttpOk,
  RECOMMENDATIONS_WAIT_TIMEOUT_MS,
} from "@/lib/test-only/assert-recommendations-response";

/** CI / E2E primary coordinate anchor (geolocation-first path). */
export const E2E_PRIMARY_COORDINATES = {
  latitude: 37.6085,
  longitude: -77.3739,
} as const;

export { RECOMMENDATIONS_WAIT_TIMEOUT_MS };

/** ZIP fallback-path anchor only — not the primary geo fence. */
export const E2E_ZIP_FALLBACK = "23111";

/**
 * Default ZIP search-center pin for e2e cache seeding.
 * Use the CI primary coordinates (not the ZIP geocode seed table alone) so
 * ranked-chain fixtures stay in the 5mi radius under Geocodio-backed local DBs.
 */
export const E2E_ZIP_FALLBACK_CENTER = {
  latitude: E2E_PRIMARY_COORDINATES.latitude,
  longitude: E2E_PRIMARY_COORDINATES.longitude,
} as const;

export const FIND_STORES_BASED_ON_ZIP_LABEL = "Find stores based on my ZIP";

export const USE_GPS_LOCATION_LABEL =
  "For Better Results, Use My GPS Location";

const ZIP_SEARCH_CENTERS_STORAGE_KEY = "yum4less.zip-search-centers.v1";

/** Skip the ZIP center-pick modal by seeding a cached pin for the ZIP. */
export async function seedZipSearchCenter(
  page: Page,
  zipCode = E2E_ZIP_FALLBACK,
  center = E2E_ZIP_FALLBACK_CENTER,
) {
  await page.evaluate(
    ({ storageKey, zip, latitude, longitude }) => {
      const existingRaw = window.localStorage.getItem(storageKey);
      let map: Record<string, { latitude: number; longitude: number }> = {};
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            map = parsed as Record<string, { latitude: number; longitude: number }>;
          }
        } catch {
          map = {};
        }
      }
      map[zip] = { latitude, longitude };
      window.localStorage.setItem(storageKey, JSON.stringify(map));
    },
    {
      storageKey: ZIP_SEARCH_CENTERS_STORAGE_KEY,
      zip: zipCode,
      latitude: center.latitude,
      longitude: center.longitude,
    },
  );
}

/**
 * Seed the ZIP search-center cache using the same geocode the server would use
 * for ZIP-only lookup — keeps e2e ranked coverage aligned with pre-picker behavior.
 */
export async function seedZipSearchCenterFromGeocode(
  page: Page,
  zipCode = E2E_ZIP_FALLBACK,
) {
  const response = await page.request.get(
    `/api/geocode/zip?zip=${encodeURIComponent(zipCode)}`,
  );
  expect(response.ok(), `geocode ZIP ${zipCode} should succeed for e2e seed`).toBeTruthy();
  const body = (await response.json()) as {
    ok?: boolean;
    location?: { latitude: number; longitude: number };
  };
  expect(body.ok).toBe(true);
  expect(body.location?.latitude).toEqual(expect.any(Number));
  expect(body.location?.longitude).toEqual(expect.any(Number));
  await seedZipSearchCenter(page, zipCode, {
    latitude: body.location!.latitude,
    longitude: body.location!.longitude,
  });
}

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

const SETTINGS_PREFERENCES_STORAGE_KEY = "yum4less.settings-preferences.v1";

export { SETTINGS_PREFERENCES_STORAGE_KEY };

export async function injectStaleSelectedStoreIds(page: Page, staleStoreIds: string[]) {
  await page.evaluate(
    ({ storageKey, storeIds }) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        throw new Error("missing settings preferences");
      }

      const prefs = JSON.parse(raw) as { selectedStoreIds?: string[] };
      prefs.selectedStoreIds = [...(prefs.selectedStoreIds ?? []), ...storeIds];
      window.localStorage.setItem(storageKey, JSON.stringify(prefs));
    },
    { storageKey: SETTINGS_PREFERENCES_STORAGE_KEY, storeIds: staleStoreIds },
  );
}

export async function readPersistedSelectedStoreIds(page: Page): Promise<string[]> {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const prefs = JSON.parse(raw) as { selectedStoreIds?: string[] };
    return prefs.selectedStoreIds ?? [];
  }, SETTINGS_PREFERENCES_STORAGE_KEY);
}

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
  await seedZipSearchCenterFromGeocode(page, zipCode);
  const findStoresButton = page.getByRole("button", {
    name: FIND_STORES_BASED_ON_ZIP_LABEL,
  });
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
  const requestBody = response.request().postDataJSON() as {
    latitude?: number;
    longitude?: number;
    zipCode?: string;
  };
  expect(requestBody.zipCode).toBe(zipCode);
  expect(typeof requestBody.latitude).toBe("number");
  expect(typeof requestBody.longitude).toBe("number");
  assertPublicNearbyStoresSanitized(body.market.nearbyStores);
  assertProductionRankedRolloutGates(body.market.nearbyStores);
  await page.getByRole("button", { name: "Save settings and continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  return body;
}

export async function completeSettingsGeolocationFlow(page: Page): Promise<MarketSearchBody> {
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  const useLocationButton = page.getByRole("button", {
    name: USE_GPS_LOCATION_LABEL,
  });
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

export async function goToPantryStep(page: Page) {
  const useAllButton = page.getByRole("button", { name: "Use all ingredients and check pantry" });
  if (await useAllButton.isVisible()) {
    await useAllButton.click();
    await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
    return;
  }
  await page.getByRole("button", { name: "Continue to pantry check" }).click();
  await expect(page.getByRole("heading", { name: "Pantry check" })).toBeVisible();
}

/**
 * Shared rank-wait: Promise.all(click + wait for POST), then fail loud on non-200.
 * Explicit timeout so pantry→rank is not fighting the rest of a fat flow for the
 * default 90s test budget alone.
 */
export async function waitForRecommendationsAfterSuggest(page: Page): Promise<{
  response: Response;
  body: {
    ok: boolean;
    experience?: {
      market: { nearbyStores: PublicNearbyStore[] };
      recommendations?: unknown[];
    };
    error?: string;
  };
}> {
  const suggestButton = page.getByRole("button", {
    name: "Suggest recipes for my store(s)",
  });
  await expect(suggestButton).not.toBeDisabled();

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/recommendations") &&
        res.request().method() === "POST",
      { timeout: RECOMMENDATIONS_WAIT_TIMEOUT_MS },
    ),
    suggestButton.click(),
  ]);

  let body: {
    ok?: boolean;
    experience?: {
      market: { nearbyStores: PublicNearbyStore[] };
      recommendations?: unknown[];
    };
    error?: string;
  } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }

  assertRecommendationsHttpOk({
    status: response.status(),
    okBody: { ok: body.ok, error: body.error },
  });

  return {
    response,
    body: {
      ok: body.ok === true,
      experience: body.experience,
      error: body.error,
    },
  };
}

export async function completePantryAndSuggestRecipes(page: Page) {
  await goToPantryStep(page);
  const result = await waitForRecommendationsAfterSuggest(page);
  await expect(page.getByRole("heading", { name: "Dinner recommendations" })).toBeVisible({
    timeout: 30_000,
  });
  return result;
}

/** @deprecated Use goToPantryStep — rank intermediate screen removed. */
export async function goToRankStep(page: Page) {
  await goToPantryStep(page);
}

export async function completePantryStepAndContinue(page: Page) {
  await completePantryAndSuggestRecipes(page);
}

export async function pickAllIngredientsAndContinue(page: Page) {
  await completePantryAndSuggestRecipes(page);
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

export function assertProductionRankedRolloutGates(
  stores: PublicNearbyStore[],
  options?: { requireKrogerInFixture?: boolean },
) {
  const requireKrogerInFixture = options?.requireKrogerInFixture ?? true;
  const rankedStores = stores.filter((store) => store.recommendationEnabled);
  expect(
    rankedStores.length,
    "expected at least one recommendation-enabled store in fixture market",
  ).toBeGreaterThanOrEqual(1);

  if (requireKrogerInFixture) {
    const kroger = findRankedStoreByChain(stores, "kroger");
    expect(kroger, "23111 fixture should include ranked Kroger").toBeTruthy();
  }

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

async function getScopedSelectedStoreIds(page: Page): Promise<string[]> {
  return page.evaluate((storageKey) => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as { selectedStoreIds?: string[] };
      return Array.isArray(parsed.selectedStoreIds) ? parsed.selectedStoreIds : [];
    } catch {
      return [];
    }
  }, SETTINGS_PREFERENCES_STORAGE_KEY);
}

export async function assertMarketSearchStoreResults(
  page: Page,
  stores: PublicNearbyStore[],
) {
  const selectedStoreIds = await getScopedSelectedStoreIds(page);
  expect(
    selectedStoreIds.length,
    "Settings should persist selected stores for map overlay assertions",
  ).toBeGreaterThan(0);

  const scopedStores = stores.filter((store) => selectedStoreIds.includes(store.id));
  expect(
    scopedStores.length,
    "selected store IDs should match stores from market-search response",
  ).toBeGreaterThan(0);

  await openMapOverlay(page);
  await expect(page.getByRole("heading", { name: "Nearby stores map" })).toBeVisible();

  const storePanel = page.locator(".map-discovery-layout, .nearby-stores-list");

  for (const store of scopedStores) {
    const storeCard = storePanel.locator(`[data-store-id="${store.id}"]`);
    await expect(
      storeCard,
      `Expected Settings-selected store ${store.id} on map overlay`,
    ).toBeVisible({ timeout: 30_000 });

    if (store.recommendationEnabled) {
      await expect(
        storeCard.getByText(/Est\. (?:sale|store) prices/i),
      ).toBeVisible();
    }
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

export async function runCoreMvpFlow(
  page: Page,
  options?: { includeMapAssertions?: boolean },
) {
  const includeMapAssertions = options?.includeMapAssertions ?? true;

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Find realistic low-cost dinner options near you/i,
    }),
  ).toBeVisible();

  const marketBody = await completeSettingsZipFlow(page);
  await completeWelcomeFlow(page);

  if (includeMapAssertions) {
    await assertMarketSearchStoreResults(page, marketBody.market.nearbyStores);
    await assertWalmartContextOnlyOnMap(page, marketBody.market.nearbyStores);
  }

  await expect(page.getByText(/^Priced$/i)).toHaveCount(0);

  const ingredientGate = page.getByRole("button", { name: "Use all ingredients and check pantry" });
  await expect(ingredientGate).toBeVisible({ timeout: 30_000 });

  const { body: recommendationsBody } = await completePantryAndSuggestRecipes(page);
  expect(recommendationsBody.ok).toBe(true);
  const rankedStores = recommendationsBody.experience?.market.nearbyStores ?? [];
  assertPublicNearbyStoresSanitized(rankedStores);
  assertProductionRankedRolloutGates(rankedStores, { requireKrogerInFixture: false });

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
  await expect(
    expandedPanel
      .getByText(
        /(?:Lowest price we found|Estimated lowest price): \$\d+\.\d{2}|Price estimate — worth verifying in store/,
      )
      .first(),
  ).toBeVisible();
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
  await expandedPanel.getByRole("button", { name: "Shopping plan" }).click();
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
