import type { MarketDataSnapshot, MarketDataSource } from "@/lib/market-repository";
import type { CatalogStore } from "@/lib/market-catalog-types";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
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
import type { StoreIdentityEnv } from "@/lib/store-identity-flags";
import type { StoreIdentityLookup } from "@/lib/store-identity-resolvers";
import { resolvePricingScopeStoreIds } from "@/lib/store-scope";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";

export type MarketPassThroughIdentityOptions = {
  identityLookup?: StoreIdentityLookup;
  env?: StoreIdentityEnv;
};

/** Build nearby rows for pricing-scope ids not already on the market list. */
export function buildPricingScopeExtraNearbyStores(input: {
  market: MarketSummary;
  pricingScopeStoreIds: string[];
  catalogStores: CatalogStore[];
  priceObservations: CatalogPriceObservation[];
  location: ResolvedSearchLocation;
  recipes: MarketDataSnapshot["recipes"];
  identityLookup?: StoreIdentityLookup;
  env?: StoreIdentityEnv;
}): NearbyStoreSummary[] {
  const existingIds = new Set(input.market.nearbyStores.map((store) => store.id));
  const missingIds = input.pricingScopeStoreIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) {
    return [];
  }

  const missingCatalog = input.catalogStores.filter((store) =>
    missingIds.includes(store.id),
  );
  if (missingCatalog.length === 0) {
    return [];
  }

  return buildNearbyStoresForSearch(
    missingCatalog,
    input.location,
    input.market.radiusMiles,
    input.priceObservations,
    collectRecipeIngredientIdsForRollout(input.recipes),
    { identityLookup: input.identityLookup, env: input.env },
  );
}

/**
 * Rebuilds full nearby-store rows from the catalog snapshot for store IDs
 * present on a thin pass-through market (coordinates, badges, rollout gates).
 * Server-only — do not import from client components.
 *
 * When identity expand is ON, catalog rows for linked alias members are also
 * eligible for rehydrate so twin ids do not vanish.
 */
export function rehydratePassedMarketNearbyStores(
  market: MarketSummary,
  snapshot: MarketDataSnapshot,
  location: ResolvedSearchLocation,
  identityOptions?: MarketPassThroughIdentityOptions,
): MarketSummary {
  const expandedPassedIds = resolvePricingScopeStoreIds({
    selectedStoreIds: market.nearbyStores.map((store) => store.id),
    identityLookup: identityOptions?.identityLookup,
    env: identityOptions?.env,
  });
  const passedStoreIds = new Set(expandedPassedIds);
  const catalogStores = snapshot.stores.filter((store) => passedStoreIds.has(store.id));
  const recipeIngredientIds = collectRecipeIngredientIdsForRollout(snapshot.recipes);
  const rehydratedById = new Map(
    buildNearbyStoresForSearch(
      catalogStores,
      location,
      market.radiusMiles,
      snapshot.priceObservations,
      recipeIngredientIds,
      identityOptions,
    ).map((store) => [store.id, store]),
  );

  const nearbyStores = market.nearbyStores
    .map((store) => resolveRehydratedStore(store, rehydratedById, identityOptions))
    .filter((store): store is NearbyStoreSummary => store !== undefined);

  return {
    ...market,
    nearbyStores,
    recommendationReadyStoreCount: nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
  };
}

function resolveRehydratedStore(
  store: NearbyStoreSummary,
  rehydratedById: Map<string, NearbyStoreSummary>,
  identityOptions?: MarketPassThroughIdentityOptions,
): NearbyStoreSummary | undefined {
  const direct = rehydratedById.get(store.id);
  if (direct) {
    return direct;
  }

  const memberIds = resolvePricingScopeStoreIds({
    selectedStoreIds: [store.id],
    identityLookup: identityOptions?.identityLookup,
    env: identityOptions?.env,
  });
  for (const memberId of memberIds) {
    const member = rehydratedById.get(memberId);
    if (member) {
      return member;
    }
  }
  return undefined;
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
  identityLookup?: StoreIdentityLookup;
  env?: StoreIdentityEnv;
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
    resolvePricingScopeStoreIds({
      selectedStoreIds: market.nearbyStores
        .filter((store) => store.recommendationEnabled)
        .map((store) => store.id),
      identityLookup: input.identityLookup,
      env: input.env,
    }),
  );
  const providerCoverageRollup = buildProviderCoverageRollup(
    providerPricingPreviews,
    deriveRankedPricingSource({
      priceSources: snapshot.priceObservations
        .filter((observation) => recommendationReadyStoreIds.has(observation.storeId))
        .map((observation) => observation.priceSource),
      recommendationEnabledStoreCount: market.nearbyStores.filter(
        (store) => store.recommendationEnabled,
      ).length,
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
    recommendationReadyStoreCount: market.nearbyStores.filter(
      (store) => store.recommendationEnabled,
    ).length,
  };
}
