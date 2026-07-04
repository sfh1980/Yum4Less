import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { MarketDataSnapshot, MarketDataSource } from "@/lib/market-repository";
import {
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
} from "@/lib/market-search-service";
import { deriveRankedPricingSource } from "@/lib/price-source-policy";
import { buildProviderCoverageRollup } from "@/lib/provider-coverage-rollup";
import { searchOfficialProviderStores } from "@/lib/provider-market-service";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import { resolveKrogerPreviewTrackedIngredients } from "@/lib/provider-search-terms";
import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";

/**
 * Rebuilds full nearby-store rows from the catalog snapshot for store IDs
 * present on a thin pass-through market (coordinates, badges, rollout gates).
 * Server-only — do not import from client components.
 */
export function rehydratePassedMarketNearbyStores(
  market: MarketSummary,
  snapshot: MarketDataSnapshot,
  location: ResolvedSearchLocation,
): MarketSummary {
  const passedStoreIds = new Set(market.nearbyStores.map((store) => store.id));
  const catalogStores = snapshot.stores.filter((store) => passedStoreIds.has(store.id));
  const recipeIngredientIds = collectRecipeIngredientIdsForRollout(snapshot.recipes);
  const rehydratedById = new Map(
    buildNearbyStoresForSearch(
      catalogStores,
      location,
      market.radiusMiles,
      snapshot.priceObservations,
      recipeIngredientIds,
    ).map((store) => [store.id, store]),
  );

  const nearbyStores = market.nearbyStores
    .map((store) => rehydratedById.get(store.id))
    .filter((store): store is NearbyStoreSummary => store !== undefined);

  return {
    ...market,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
  };
}

/**
 * Recomputes trust-sensitive market fields from server state so client pass-through
 * cannot spoof lookup source, data availability, or pricing coverage rollup.
 */
export async function recomputePassedMarketTrustFields(input: {
  market: MarketSummary;
  snapshot: MarketDataSnapshot;
  snapshotSource: MarketDataSource;
  location: ResolvedSearchLocation;
  providerConfigured: boolean;
}): Promise<MarketSummary> {
  const { market, snapshot, snapshotSource, location, providerConfigured } = input;
  const providerStoreSearches = await searchOfficialProviderStores({
    location,
    radiusMiles: market.radiusMiles,
  });
  const coverageTrackedIngredients = await resolveKrogerPreviewTrackedIngredients();
  const providerPricingPreviews = await buildProviderPricingPreviews({
    providerStores: providerStoreSearches.flatMap((search) => search.stores),
    trackedIngredients: coverageTrackedIngredients,
  });
  const recommendationReadyStoreIds = new Set(
    market.nearbyStores
      .filter((store) => store.recommendationEnabled)
      .map((store) => store.id),
  );
  const providerCoverageRollup = buildProviderCoverageRollup(
    providerPricingPreviews,
    deriveRankedPricingSource({
      priceSources: snapshot.priceObservations
        .filter((observation) => recommendationReadyStoreIds.has(observation.storeId))
        .map((observation) => observation.priceSource),
      recommendationEnabledStoreCount: recommendationReadyStoreIds.size,
    }),
    coverageTrackedIngredients,
  );

  return {
    ...market,
    lookupSource: location.source,
    lookupProviderConfigured: providerConfigured,
    dataSource: snapshotSource,
    providerStoreSearches,
    providerPricingPreviews,
    providerCoverageRollup,
    recommendationReadyStoreCount: recommendationReadyStoreIds.size,
  };
}
