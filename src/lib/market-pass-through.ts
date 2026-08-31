import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type {
  MealPreferenceForm,
  MarketSummary,
} from "@/lib/recommendation-service";
import type { PublicMarketSummary } from "@/lib/public-api-response-sanitizer";
import type { ProviderRolloutStatus } from "@/lib/provider-rollout";

const PASSED_STORE_ROLLOUT_STATUSES = new Set<ProviderRolloutStatus>([
  "weekly-ad-preview",
  "official-api-preview",
  "limited-coverage",
  "coming-soon",
]);

const LOCATION_EPSILON_DEGREES = 0.02;

export type PassedMarketValidationResult =
  | { ok: true; market: MarketSummary }
  | { ok: false; reason: string };

export function parsePassedMarketSummary(value: unknown): MarketSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublicMarketSummary>;

  if (
    typeof candidate.locationLabel !== "string" ||
    typeof candidate.searchLatitude !== "number" ||
    typeof candidate.searchLongitude !== "number" ||
    typeof candidate.radiusMiles !== "number" ||
    !Array.isArray(candidate.nearbyStores) ||
    typeof candidate.recommendationReadyStoreCount !== "number" ||
    !Array.isArray(candidate.providerRollout) ||
    !Array.isArray(candidate.providerStoreSearches) ||
    !Array.isArray(candidate.providerPricingPreviews) ||
    !candidate.providerCoverageRollup ||
    typeof candidate.providerCoverageRollup !== "object" ||
    !Array.isArray(candidate.providerPromotionReadiness) ||
    !Array.isArray(candidate.providerPriceObservationSync) ||
    !Array.isArray(candidate.weeklyAdIngestionStatus) ||
    !Array.isArray(candidate.weeklyAdPromotionReadiness) ||
    typeof candidate.lookupSource !== "string" ||
    typeof candidate.lookupProviderConfigured !== "boolean" ||
    (candidate.dataSource !== "database" && candidate.dataSource !== "unavailable") ||
    !Array.isArray(candidate.saleIngredientChoices)
  ) {
    return null;
  }

  if (
    candidate.shopperRankedChainIds !== undefined &&
    (!Array.isArray(candidate.shopperRankedChainIds) ||
      candidate.shopperRankedChainIds.some((id) => typeof id !== "string"))
  ) {
    return null;
  }

  for (const store of candidate.nearbyStores) {
    if (
      !store ||
      typeof store !== "object" ||
      typeof store.id !== "string" ||
      typeof store.name !== "string" ||
      typeof store.chain !== "string" ||
      typeof store.recommendationEnabled !== "boolean" ||
      typeof store.rolloutStatus !== "string" ||
      !PASSED_STORE_ROLLOUT_STATUSES.has(store.rolloutStatus as ProviderRolloutStatus) ||
      typeof store.rolloutNote !== "string"
    ) {
      return null;
    }
  }

  return candidate as MarketSummary;
}

const EMPTY_PROVIDER_COVERAGE_ROLLUP = {
  overallCoverageStatus: "limited" as const,
  trustGate: "monitoring" as const,
  rankedPricingSource: "weekly-ad-cache" as const,
  totalTrackedIngredients: 0,
  matchedIngredientCount: 0,
  unmatchedIngredientCount: 0,
  averageMatchConfidence: 0,
  usesCachedPreview: false,
  ingredientSummaries: [],
  message: "",
};

/**
 * Shrinks a full market-search snapshot to the fields ranking pass-through
 * validates and uses, keeping POST /api/recommendations under the JSON body cap.
 */
export function trimMarketForRankingPassThrough(market: MarketSummary): MarketSummary {
  return {
    searchedZipCode: market.searchedZipCode,
    locationLabel: market.locationLabel,
    searchLatitude: market.searchLatitude,
    searchLongitude: market.searchLongitude,
    radiusMiles: market.radiusMiles,
    recommendationReadyStoreCount: market.recommendationReadyStoreCount,
    lookupSource: market.lookupSource,
    lookupProviderConfigured: market.lookupProviderConfigured,
    dataSource: market.dataSource,
    nearbyStores: market.nearbyStores.map((store) => ({
      id: store.id,
      name: store.name,
      chain: store.chain,
      recommendationEnabled: store.recommendationEnabled,
      rolloutStatus: store.rolloutStatus,
      rolloutNote: store.rolloutNote,
    })) as MarketSummary["nearbyStores"],
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: market.providerCoverageRollup ?? EMPTY_PROVIDER_COVERAGE_ROLLUP,
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    saleIngredientChoices: [],
  };
}

export function validatePassedMarketForRanking(input: {
  market: MarketSummary;
  preferences: MealPreferenceForm;
  location: ResolvedSearchLocation;
}): PassedMarketValidationResult {
  if (input.market.radiusMiles !== input.preferences.radiusMiles) {
    return {
      ok: false,
      reason:
        "Market snapshot radius does not match the recommendation request. Find nearby stores again after changing radius.",
    };
  }

  if (
    Math.abs(input.market.searchLatitude - input.location.latitude) >
      LOCATION_EPSILON_DEGREES ||
    Math.abs(input.market.searchLongitude - input.location.longitude) >
      LOCATION_EPSILON_DEGREES
  ) {
    return {
      ok: false,
      reason:
        "Market snapshot location does not match the recommendation request. Find nearby stores again for this location.",
    };
  }

  const requestZip = input.preferences.zipCode.trim();
  const marketZip = input.market.searchedZipCode?.trim() ?? "";
  if (requestZip && marketZip && requestZip !== marketZip) {
    return {
      ok: false,
      reason:
        "Market snapshot ZIP does not match the recommendation request. Find nearby stores again after changing ZIP.",
    };
  }

  const readyCount = input.market.nearbyStores.filter(
    (store) => store.recommendationEnabled,
  ).length;
  if (readyCount !== input.market.recommendationReadyStoreCount) {
    return {
      ok: false,
      reason: "Market snapshot store readiness counts are inconsistent.",
    };
  }

  return { ok: true, market: input.market };
}
