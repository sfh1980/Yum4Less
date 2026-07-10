import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";
import type { ProviderCoverageRollup } from "@/lib/provider-coverage-rollup";

export function buildTestProviderCoverageRollup(
  overrides: Partial<ProviderCoverageRollup> = {},
): ProviderCoverageRollup {
  return {
    overallCoverageStatus: "limited",
    trustGate: "monitoring",
    rankedPricingSource: "weekly-ad-cache",
    totalTrackedIngredients: 97,
    matchedIngredientCount: 12,
    unmatchedIngredientCount: 85,
    averageMatchConfidence: 0.8,
    usesCachedPreview: false,
    ingredientSummaries: [],
    message: "Fixture coverage rollup.",
    ...overrides,
  };
}

export function buildTestNearbyStoreSummary(
  overrides: Partial<NearbyStoreSummary> = {},
): NearbyStoreSummary {
  return {
    id: "kroger-mechanicsville",
    name: "Kroger Mechanicsville",
    city: "Mechanicsville",
    state: "VA",
    kind: "grocery",
    latitude: 37.6085,
    longitude: -77.3321,
    distanceMiles: 1.2,
    chain: "kroger",
    chainLabel: "Kroger",
    rolloutStatus: "weekly-ad-preview",
    recommendationEnabled: true,
    rolloutNote: "Fixture coverage.",
    matchedIngredientCount: 12,
    totalTrackedIngredientCount: 97,
    pricingSourceKind: "weekly-ad",
    locationProvenance: "bootstrap",
    locationBadge: "Seed catalog pin",
    locationNote: "Fixture seed catalog coordinates.",
    ...overrides,
  };
}

export function buildTestMarketSummary(
  overrides: Partial<MarketSummary> = {},
): MarketSummary {
  return {
    searchedZipCode: "23111",
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6085,
    searchLongitude: -77.3321,
    radiusMiles: 5,
    nearbyStores: [],
    recommendationReadyStoreCount: 1,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: buildTestProviderCoverageRollup(),
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "database",
    saleIngredientChoices: [],
    message: "Fixture market search.",
    ...overrides,
  };
}

export function buildTestMarketSummaryPick<T extends keyof MarketSummary>(
  fields: readonly T[],
  overrides: Partial<MarketSummary> = {},
): Pick<MarketSummary, T> {
  const full = buildTestMarketSummary(overrides);
  const picked = {} as Pick<MarketSummary, T>;
  for (const field of fields) {
    picked[field] = full[field];
  }
  return picked;
}
