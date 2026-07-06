import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
  CatalogStore,
} from "@/lib/market-catalog-types";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  getMarketDataSnapshot,
  type MarketDataSnapshot,
  type MarketDataSource,
} from "@/lib/market-repository";
import {
  getProviderRolloutForCatalogStore,
  listResolvedProviderRollout,
  resolveProviderRolloutForCatalogStore,
  type StoreChain,
} from "@/lib/provider-rollout";
import { searchOfficialProviderStores } from "@/lib/provider-market-service";
import { deriveRankedPricingSource } from "@/lib/price-source-policy";
import {
  buildProviderCoverageRollup,
  type ProviderCoverageRollup,
} from "@/lib/provider-coverage-rollup";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import { resolveKrogerPreviewTrackedIngredients } from "@/lib/provider-search-terms";
import type { ProviderPriceObservationSyncSummary } from "@/lib/provider-price-observation-sync";
import {
  buildAllProviderPromotionReadiness,
  type ProviderPromotionReadiness,
} from "@/lib/provider-promotion-readiness";
import type {
  ProviderPricingPreviewResult,
  ProviderStoreSearchResult,
} from "@/lib/providers/provider-types";
import { getWeeklyAdIngestionMarketSummaries } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import type { WeeklyAdIngestionStatusSummary } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import {
  buildWeeklyAdStoreCoverage,
  weeklyAdPromotionGatesPass,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";
import {
  buildKrogerOfficialApiStoreCoverage,
  krogerOfficialApiPromotionGatesPass,
} from "@/lib/kroger-official-api-coverage";
import {
  buildWeeklyAdPromotionReadinessForStores,
  type WeeklyAdPromotionReadiness,
} from "@/lib/weekly-ad-ingestion/weekly-ad-promotion-readiness";
import { buildNearbySaleIngredientChoices } from "@/lib/sale-ingredient-offers";
import {
  discoverMapContextStores,
  mapContextCandidateToCatalogStore,
  type MapContextDiscoveryResult,
} from "@/lib/map-context-discovery";
import {
  filterMapContextCatalogStoresConflictingWithIngestedRankedChains,
  needsSearchTimeOsmGapFill,
  resolveMapOsmRankedChainPolicy,
  shouldRunSearchTimeOsmDiscovery,
} from "@/lib/map-osm-ranked-chain-policy";
import {
  dedupeKrogerStoresByIdentity,
  filterSupersededOsmKrogerFixturePins,
} from "@/lib/kroger-catalog-canonical";
import {
  buildCatalogStoresFromProviderSearches,
  catalogStoreRecordToCatalogStore,
  MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
  mergeCatalogStoresForMap,
} from "@/lib/market-store-catalog-merge";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";
import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-types";

export async function getMarketSearchExperience(
  radiusMiles: number,
  location: ResolvedSearchLocation,
  providerConfigured: boolean,
): Promise<{
  market: MarketSummary;
  snapshot: Awaited<ReturnType<typeof getMarketDataSnapshot>>["snapshot"];
}> {
  const providerStoreSearches = await searchOfficialProviderStores({
    location,
    radiusMiles,
  });

  let { snapshot, source } = await getMarketDataSnapshot();
  const recipeIngredientIds = collectRecipeIngredientIds(snapshot.recipes);

  const providerCatalogStores = buildCatalogStoresFromProviderSearches(
    providerStoreSearches,
  ).map(catalogStoreRecordToCatalogStore);

  let mergedCatalogStores = mergeCatalogStoresForMap(
    snapshot.stores,
    providerCatalogStores,
  );

  let mapDiscoveryNotice: string | undefined;
  let usesEphemeralOsmDiscovery = false;
  const osmRankedChainPolicy = resolveMapOsmRankedChainPolicy();

  if (
    source !== "unavailable" &&
    shouldRunSearchTimeOsmDiscovery(osmRankedChainPolicy) &&
    needsSearchTimeOsmGapFill(
      snapshot.stores,
      location.latitude,
      location.longitude,
      radiusMiles,
    )
  ) {
    const gapFillOutcome = await discoverMapContextStoresWithinBudget({
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMiles,
      zipCode: location.zipCode,
    });

    if (gapFillOutcome.timedOut) {
      mapDiscoveryNotice =
        "Saved store locations loaded first. Additional map-context pins may appear on a later refresh while background discovery warms.";
    } else {
      const mapContextDiscovery = gapFillOutcome.result;

      if (mapContextDiscovery.stores.length > 0) {
        let contextCatalogStores = mapContextDiscovery.stores
          .map(mapContextCandidateToCatalogStore)
          .map(catalogStoreRecordToCatalogStore);

        let suppressedRankedChainConflicts = 0;
        if (osmRankedChainPolicy === "suppress-conflicts") {
          const filtered = filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
            mergedCatalogStores,
            contextCatalogStores,
            MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
          );
          contextCatalogStores = filtered.kept;
          suppressedRankedChainConflicts = filtered.suppressedCount;
        }

        if (contextCatalogStores.length > 0) {
          mergedCatalogStores = mergeCatalogStoresForMap(
            mergedCatalogStores,
            contextCatalogStores,
          );
          usesEphemeralOsmDiscovery = true;
        }

        const osmSource = mapContextDiscovery.sources.find(
          (entry) => entry.source === "openstreetmap-overpass" || entry.source === "fixture",
        );
        const snapSource = mapContextDiscovery.sources.find(
          (entry) => entry.source === "usda-snap-retailer-locator",
        );

        if (contextCatalogStores.length === 0 && suppressedRankedChainConflicts > 0) {
          mapDiscoveryNotice =
            "Some map pins were skipped because saved store locations already cover those stores nearby.";
        } else if (contextCatalogStores.length > 0) {
          const parts: string[] = [];
          if (osmSource && osmSource.stores.length > 0) {
            parts.push(
              osmSource.cacheHit
                ? "cached map context pins"
                : "map context pins",
            );
          }
          if (snapSource && snapSource.stores.length > 0) {
            parts.push("directory context pins (verify in store)");
          }
          mapDiscoveryNotice = `Map includes ${parts.join(" and ")} for gaps only — not live checkout data. Saved store locations are preferred when available.`;
        }
      } else {
        mapDiscoveryNotice =
          "Some nearby stores may be missing from the map. Verify store locations before visiting.";
      }
    }
  }

  mergedCatalogStores = dedupeKrogerStoresByIdentity(mergedCatalogStores);
  mergedCatalogStores = filterSupersededOsmKrogerFixturePins(
    mergedCatalogStores,
    location,
    radiusMiles,
  );

  let nearbyStores = buildNearbyStoresForSearch(
    mergedCatalogStores,
    location,
    radiusMiles,
    snapshot.priceObservations,
    recipeIngredientIds,
  );
  const coverageTrackedIngredients = await resolveKrogerPreviewTrackedIngredients();
  const providerPricingPreviews = await buildProviderPricingPreviews({
    providerStores: providerStoreSearches.flatMap((search) => search.stores),
    trackedIngredients: coverageTrackedIngredients,
  });

  const recommendationReadyStores = nearbyStores.filter(
    (store) => store.recommendationEnabled,
  );
  const recommendationReadyStoreIds = new Set(
    recommendationReadyStores.map((store) => store.id),
  );
  const providerCoverageRollup = buildProviderCoverageRollup(
    providerPricingPreviews,
    deriveRankedPricingSource({
      priceSources: snapshot.priceObservations
        .filter((observation) =>
          recommendationReadyStoreIds.has(observation.storeId),
        )
        .map((observation) => observation.priceSource),
      recommendationEnabledStoreCount: recommendationReadyStores.length,
    }),
    coverageTrackedIngredients,
  );
  const providerPromotionReadiness = buildAllProviderPromotionReadiness({
    previews: providerPricingPreviews,
    trackedIngredients: coverageTrackedIngredients,
  });
  const weeklyAdIngestionStatus = await getWeeklyAdIngestionMarketSummaries({
    storeIds: nearbyStores.map((store) => store.id),
  });
  const weeklyAdPromotionReadiness = buildWeeklyAdPromotionReadinessForStores({
    stores: nearbyStores.map((store) => ({
      id: store.id,
      name: store.name,
      chain: store.chain,
    })),
    coverageByStoreId: buildWeeklyAdCoverageByStoreId(
      nearbyStores,
      snapshot.priceObservations,
      recipeIngredientIds,
    ),
  });

  return {
    snapshot,
    market: buildMarketSummary(
      radiusMiles,
      nearbyStores,
      providerStoreSearches,
      providerPricingPreviews,
      providerCoverageRollup,
      providerPromotionReadiness,
      [],
      weeklyAdIngestionStatus,
      weeklyAdPromotionReadiness,
      location,
      providerConfigured,
      source,
      snapshot,
      {
        mapDiscoveryNotice,
        usesEphemeralOsmDiscovery,
      },
    ),
  };
}

export function buildNearbyStoresForSearch(
  stores: CatalogStore[],
  location: ResolvedSearchLocation,
  radiusMiles: number,
  priceObservations: CatalogPriceObservation[],
  recipeIngredientIds: string[],
): NearbyStoreSummary[] {
  return stores
    .map((store) => {
      const baseRollout = getProviderRolloutForCatalogStore(store);
      const coverage = buildWeeklyAdStoreCoverage({
        storeId: store.id,
        chain: baseRollout.chain,
        priceObservations,
        recipeIngredientIds,
      });
      const officialApiCoverage =
        baseRollout.chain === "kroger"
          ? buildKrogerOfficialApiStoreCoverage({
              storeId: store.id,
              priceObservations,
            })
          : null;
      const rollout = resolveProviderRolloutForCatalogStore(store, {
        matchedIngredientCount: coverage.matchedIngredientCount,
        usesWeeklyAdSource: coverage.usesWeeklyAdSource,
        weeklyAdPromotionPassed: weeklyAdPromotionGatesPass(
          coverage,
          baseRollout.chain,
        ),
        krogerOfficialApiPromotionPassed:
          officialApiCoverage !== null &&
          krogerOfficialApiPromotionGatesPass(officialApiCoverage),
        freshOfficialApiMatchedCount:
          officialApiCoverage?.freshMatchedIngredientCount ?? 0,
      });
      return {
        id: store.id,
        name: store.name,
        city: store.city,
        state: store.state,
        kind: store.kind,
        latitude: store.latitude,
        longitude: store.longitude,
        distanceMiles: roundDistanceMiles(
          getDistanceMiles(
            location.latitude,
            location.longitude,
            store.latitude,
            store.longitude,
          ),
        ),
        chain: rollout.chain,
        chainLabel: rollout.label,
        rolloutStatus: rollout.status,
        recommendationEnabled: rollout.recommendationEnabled,
        rolloutNote: rollout.note,
        sourceName: store.sourceName,
        sourceStoreId: store.sourceStoreId,
        lastVerifiedAt: store.lastVerifiedAt,
        locationProvenance: resolveStoreMapLocationProvenance({
          storeId: store.id,
          sourceName: store.sourceName,
          lastVerifiedAt: store.lastVerifiedAt,
        }),
        locationBadge: buildStoreMapLocationBadge({
          storeId: store.id,
          sourceName: store.sourceName,
          lastVerifiedAt: store.lastVerifiedAt,
        }),
        locationNote: buildStoreMapLocationNote({
          storeId: store.id,
          sourceName: store.sourceName,
          lastVerifiedAt: store.lastVerifiedAt,
        }),
      };
    })
    .filter((store) => store.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}

export function collectRecipeIngredientIdsForRollout(
  recipes: CatalogRecipeRecord[],
): string[] {
  return [
    ...new Set(
      recipes.flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ingredient.ingredientId),
      ),
    ),
  ];
}

function collectRecipeIngredientIds(recipes: CatalogRecipeRecord[]): string[] {
  return collectRecipeIngredientIdsForRollout(recipes);
}

const MAP_SEARCH_GAP_FILL_TIMEOUT_MS = 3_000;

function resolveMapSearchGapFillTimeoutMs(
  value = process.env.YUM4LESS_MAP_SEARCH_GAP_FILL_TIMEOUT_MS,
): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return MAP_SEARCH_GAP_FILL_TIMEOUT_MS;
}

async function discoverMapContextStoresWithinBudget(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
}): Promise<
  | { timedOut: true }
  | { timedOut: false; result: MapContextDiscoveryResult }
> {
  const timeoutMs = resolveMapSearchGapFillTimeoutMs();
  const discoveryPromise = discoverMapContextStores(input);

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });

  const discoveryOutcome = discoveryPromise.then((result) => ({
    timedOut: false as const,
    result,
  }));

  const outcome = await Promise.race([discoveryOutcome, timeoutPromise]);
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  if (outcome.timedOut) {
    void discoveryPromise.catch(() => undefined);
    console.warn(
      `[market-search] deferred map context discovery after ${timeoutMs}ms for ${input.latitude.toFixed(3)},${input.longitude.toFixed(3)} radius=${input.radiusMiles}`,
    );
  }

  return outcome;
}

function buildWeeklyAdCoverageByStoreId(
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  recipeIngredientIds: string[],
) {
  const coverageByStoreId = new Map<
    string,
    ReturnType<typeof buildWeeklyAdStoreCoverage>
  >();

  for (const store of nearbyStores) {
    coverageByStoreId.set(
      store.id,
      buildWeeklyAdStoreCoverage({
        storeId: store.id,
        chain: store.chain,
        priceObservations,
        recipeIngredientIds,
      }),
    );
  }

  return coverageByStoreId;
}

function buildMarketSummary(
  radiusMiles: number,
  nearbyStores: NearbyStoreSummary[],
  providerStoreSearches: ProviderStoreSearchResult[],
  providerPricingPreviews: ProviderPricingPreviewResult[],
  providerCoverageRollup: ProviderCoverageRollup,
  providerPromotionReadiness: ProviderPromotionReadiness[],
  providerPriceObservationSync: ProviderPriceObservationSyncSummary[],
  weeklyAdIngestionStatus: WeeklyAdIngestionStatusSummary[],
  weeklyAdPromotionReadiness: WeeklyAdPromotionReadiness[],
  location: ResolvedSearchLocation,
  lookupProviderConfigured: boolean,
  dataSource: MarketDataSource,
  snapshot: MarketDataSnapshot,
  mapDiscovery?: {
    mapDiscoveryNotice?: string;
    usesEphemeralOsmDiscovery?: boolean;
  },
): MarketSummary {
  const recommendationReadyStoreCount = nearbyStores.filter(
    (store) => store.recommendationEnabled,
  ).length;
  const saleIngredientChoices = buildNearbySaleIngredientChoices({
    nearbyStores: nearbyStores.filter((store) => store.recommendationEnabled),
    priceObservations: snapshot.priceObservations,
    ingredients: snapshot.ingredients ?? [],
  });
  const searchedZipCode = location.zipCode;
  const locationLabel =
    location.source === "browser"
      ? "Current location"
      : `${location.city}, ${location.state}`;
  const weeklyAdPromotionByChain = Object.fromEntries(
    weeklyAdPromotionReadiness
      .filter((readiness) => readiness.weeklyAdRankedPricingEnabled)
      .map((readiness) => [
        readiness.chain,
        {
          matchedIngredientCount: 0,
          usesWeeklyAdSource: true,
          weeklyAdPromotionPassed: true,
        },
      ]),
  ) as Partial<
    Record<
      StoreChain,
      {
        matchedIngredientCount: number;
        usesWeeklyAdSource: boolean;
        weeklyAdPromotionPassed: boolean;
      }
    >
  >;

  return {
    searchedZipCode,
    locationLabel,
    searchLatitude: location.latitude,
    searchLongitude: location.longitude,
    radiusMiles,
    nearbyStores,
    recommendationReadyStoreCount,
    providerRollout: listResolvedProviderRollout({
      weeklyAdPromotionByChain,
    }),
    providerStoreSearches,
    providerPricingPreviews,
    providerCoverageRollup,
    providerPromotionReadiness,
    providerPriceObservationSync,
    weeklyAdIngestionStatus,
    weeklyAdPromotionReadiness,
    lookupSource: location.source,
    lookupProviderConfigured,
    dataSource,
    saleIngredientChoices,
    ...(mapDiscovery?.mapDiscoveryNotice
      ? { mapDiscoveryNotice: mapDiscovery.mapDiscoveryNotice }
      : {}),
    ...(mapDiscovery?.usesEphemeralOsmDiscovery
      ? { usesEphemeralOsmDiscovery: true }
      : {}),
  };
}

function roundDistanceMiles(value: number) {
  return Math.round(value * 10) / 10;
}

function getDistanceMiles(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
