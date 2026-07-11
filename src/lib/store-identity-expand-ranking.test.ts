/**
 * Option A Slice 2 — silent-empty-scope + membership expand on rank path.
 * T1–T4 names are intentional close-out markers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLinkedKrogerIdentityLookup,
  FIXTURE_FOOD_LION_A,
  FIXTURE_FOOD_LION_B_NEARBY,
  FIXTURE_KROGER_API,
  FIXTURE_KROGER_SLUG,
} from "@/lib/fixtures/store-identity.fixtures";
import { resetDbPoolForTests } from "@/lib/db";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import {
  buildZip23111RankingSnapshot,
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import {
  expandStoreIds,
  expandStoreIdsForRead,
  scopeStoreIdsForPricing,
} from "@/lib/store-identity-resolvers";
import {
  filterPriceObservationsByStoreIds,
  resolvePricingScopeStoreIds,
  resolveSelectedStoreIdsForRanking,
} from "@/lib/store-scope";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import { buildNearbyStoresForSearch } from "@/lib/market-search-service";
import type { MarketSummary } from "@/lib/recommendation-types";

const { buildProviderPricingPreviews } = vi.hoisted(() => ({
  buildProviderPricingPreviews: vi.fn(),
}));

const { getMarketDataSnapshot } = vi.hoisted(() => ({
  getMarketDataSnapshot: vi.fn(),
}));

const { getLatestThemealdbImportAt, shouldRefreshThemealdbRecipesOnSearch } =
  vi.hoisted(() => ({
    getLatestThemealdbImportAt: vi.fn(),
    shouldRefreshThemealdbRecipesOnSearch: vi.fn(),
  }));

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/market-repository", () => ({
  getMarketDataSnapshot,
}));

vi.mock("@/lib/recipe-import/ensure-themealdb-recipes-for-search", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recipe-import/ensure-themealdb-recipes-for-search")
  >("@/lib/recipe-import/ensure-themealdb-recipes-for-search");

  return {
    ...actual,
    getLatestThemealdbImportAt,
    shouldRefreshThemealdbRecipesOnSearch,
  };
});

const EXPAND_ON = { YUM4LESS_STORE_IDENTITY_EXPAND: "1" } as const;
const EXPAND_OFF = {} as const;

function buildKrogerTwinSilentEmptySnapshot() {
  const base = buildZip23111RankingSnapshot(["kroger-mechanicsville"]);
  const slug = base.stores.find((store) => store.id === "kroger-mechanicsville");
  if (!slug) {
    throw new Error("missing kroger-mechanicsville fixture store");
  }

  return {
    ...base,
    stores: [
      ...base.stores,
      {
        ...slug,
        id: FIXTURE_KROGER_API.id,
        name: FIXTURE_KROGER_API.name,
        latitude: FIXTURE_KROGER_API.latitude,
        longitude: FIXTURE_KROGER_API.longitude,
        sourceName: "kroger-official-api",
        sourceStoreId: "02900529",
      },
    ],
    // Observations stay on the slug twin only — classic silent-empty mismatch.
    priceObservations: base.priceObservations.map((observation) => ({
      ...observation,
      storeId: FIXTURE_KROGER_SLUG.id,
    })),
  };
}

function buildMarketWithStores(
  snapshot: ReturnType<typeof buildKrogerTwinSilentEmptySnapshot>,
  storeIds: string[],
): MarketSummary {
  const catalog = snapshot.stores.filter((store) => storeIds.includes(store.id));
  const nearbyStores = buildNearbyStoresForSearch(
    catalog,
    zip23111MechanicsvilleLocation,
    zip23111RankingPreferences.radiusMiles,
    snapshot.priceObservations,
    snapshot.recipes.flatMap((recipe) =>
      recipe.ingredients.map((ingredient) => ingredient.ingredientId),
    ),
  );

  return {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: zip23111MechanicsvilleLocation.latitude,
    searchLongitude: zip23111MechanicsvilleLocation.longitude,
    radiusMiles: zip23111RankingPreferences.radiusMiles,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      overallCoverageStatus: "limited",
      trustGate: "monitoring",
      rankedPricingSource: "weekly-ad-cache",
      totalTrackedIngredients: 0,
      matchedIngredientCount: 0,
      unmatchedIngredientCount: 0,
      averageMatchConfidence: 0,
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "Fixture coverage rollup.",
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "database",
    saleIngredientChoices: [],
  };
}

describe("Slice 2 identity expand on ranking/pantry (T1–T4 + membership)", () => {
  beforeEach(() => {
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    getLatestThemealdbImportAt.mockResolvedValue(null);
    shouldRefreshThemealdbRecipesOnSearch.mockReturnValue(false);
  });

  afterEach(async () => {
    await resetDbPoolForTests();
    vi.clearAllMocks();
  });

  it("T1 silent-empty guard: flag ON + select API + obs on slug → non-empty recommendations", async () => {
    const snapshot = buildKrogerTwinSilentEmptySnapshot();
    getMarketDataSnapshot.mockResolvedValue({ source: "database", snapshot });
    const lookup = createLinkedKrogerIdentityLookup();
    const market = buildMarketWithStores(snapshot, [
      FIXTURE_KROGER_API.id,
      FIXTURE_KROGER_SLUG.id,
    ]);

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        selectedStoreIds: [FIXTURE_KROGER_API.id],
      },
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: market,
        identityLookup: lookup,
        storeIdentityEnv: EXPAND_ON,
      },
    );

    expect(experience.recommendations.length).toBeGreaterThan(0);
    expect(experience.shopperNotice?.title).not.toBe(
      "No sale ingredients at selected store(s)",
    );
  });

  it("T2 flag OFF regression: same twin fixture stays exact-id empty", async () => {
    const snapshot = buildKrogerTwinSilentEmptySnapshot();
    getMarketDataSnapshot.mockResolvedValue({ source: "database", snapshot });
    const lookup = createLinkedKrogerIdentityLookup();
    const market = buildMarketWithStores(snapshot, [
      FIXTURE_KROGER_API.id,
      FIXTURE_KROGER_SLUG.id,
    ]);

    const experience = await getRecommendationExperience(
      {
        ...zip23111RankingPreferences,
        selectedStoreIds: [FIXTURE_KROGER_API.id],
      },
      zip23111MechanicsvilleLocation,
      false,
      {
        passedMarket: market,
        identityLookup: lookup,
        storeIdentityEnv: EXPAND_OFF,
      },
    );

    expect(experience.recommendations).toHaveLength(0);
    expect(experience.shopperNotice?.title).toMatch(
      /No sale ingredients|No ranked stores/,
    );
  });

  it("T3 negative: ~0.2 mi Food Lion pair does not expand across unlinked same-chain stores", () => {
    const lookup = createLinkedKrogerIdentityLookup();
    const selectedIds = [FIXTURE_FOOD_LION_A.id];
    const observationStoreIds = [FIXTURE_FOOD_LION_B_NEARBY.id];

    const scoped = scopeStoreIdsForPricing({
      selectedIds,
      observationStoreIds,
      expand: (ids) => expandStoreIdsForRead(lookup, ids, EXPAND_ON),
    });
    expect(scoped).toEqual([]);

    const pricingScope = resolvePricingScopeStoreIds({
      selectedStoreIds: selectedIds,
      identityLookup: lookup,
      env: EXPAND_ON,
    });
    expect(pricingScope).toEqual(selectedIds);

    const observations: CatalogPriceObservation[] = [
      {
        storeId: FIXTURE_FOOD_LION_B_NEARBY.id,
        ingredientId: "chicken-thighs",
        price: 5,
        priceSource: "food-lion-weekly-ad-scrape",
        freshnessDaysAgo: 1,
        inStock: true,
      },
    ];
    expect(
      filterPriceObservationsByStoreIds(observations, pricingScope),
    ).toEqual([]);
  });

  it("T4 expand-bypass: filterPriceObservationsByStoreIds is the live ranking caller of pricing scope", () => {
    const lookup = createLinkedKrogerIdentityLookup();
    const selectedIds = [FIXTURE_KROGER_API.id];
    const observations: CatalogPriceObservation[] = [
      {
        storeId: FIXTURE_KROGER_SLUG.id,
        ingredientId: "chicken-thighs",
        price: 6.49,
        priceSource: "kroger-weekly-ad-scrape",
        freshnessDaysAgo: 1,
        inStock: true,
      },
    ];

    const exactIdOnly = resolvePricingScopeStoreIds({
      selectedStoreIds: selectedIds,
      identityLookup: lookup,
      env: EXPAND_OFF,
    });
    expect(filterPriceObservationsByStoreIds(observations, exactIdOnly)).toEqual(
      [],
    );

    const expanded = resolvePricingScopeStoreIds({
      selectedStoreIds: selectedIds,
      identityLookup: lookup,
      env: EXPAND_ON,
    });
    expect(filterPriceObservationsByStoreIds(observations, expanded)).toEqual(
      observations,
    );

    // Pure helper still pins the anti-pattern for expand bypass.
    expect(
      scopeStoreIdsForPricing({
        selectedIds,
        observationStoreIds: [FIXTURE_KROGER_SLUG.id],
        expand: (ids) => [...ids],
      }),
    ).toEqual([]);
    expect(
      scopeStoreIdsForPricing({
        selectedIds,
        observationStoreIds: [FIXTURE_KROGER_SLUG.id],
        expand: (ids) => expandStoreIds(lookup, ids),
      }),
    ).toEqual([FIXTURE_KROGER_SLUG.id]);
  });

  it("membership: select twin not in market.nearbyStores but linked to one that is → no false-drop when flag ON", () => {
    const lookup = createLinkedKrogerIdentityLookup();
    const marketNearbyStores = [
      buildTestNearbyStoreSummary({
        id: FIXTURE_KROGER_SLUG.id,
        name: "Kroger",
        chain: "kroger",
        chainLabel: "Kroger",
        latitude: FIXTURE_KROGER_SLUG.latitude,
        longitude: FIXTURE_KROGER_SLUG.longitude,
        distanceMiles: 1.2,
        recommendationEnabled: true,
      }),
    ];

    const off = resolveSelectedStoreIdsForRanking({
      selectedStoreIds: [FIXTURE_KROGER_API.id],
      marketNearbyStores,
      identityLookup: lookup,
      env: EXPAND_OFF,
    });
    expect(off.effectiveSelectedStoreIds).toEqual([]);
    expect(off.droppedStoreIds).toEqual([FIXTURE_KROGER_API.id]);

    const on = resolveSelectedStoreIdsForRanking({
      selectedStoreIds: [FIXTURE_KROGER_API.id],
      marketNearbyStores,
      identityLookup: lookup,
      env: EXPAND_ON,
    });
    expect(on.effectiveSelectedStoreIds).toEqual([FIXTURE_KROGER_SLUG.id]);
    expect(on.droppedStoreIds).toEqual([]);
  });
});
