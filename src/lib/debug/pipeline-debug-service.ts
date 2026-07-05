import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  getMarketPricingContext,
  getRankedPriceObservationsWithTimestamps,
  getRecipeCatalog,
} from "@/lib/market-repository";
import { resolveKrogerPreviewTrackedIngredients } from "@/lib/provider-search-terms";
import type { ProviderRolloutStatus, StoreChain } from "@/lib/provider-rollout";
import {
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
  type NearbyStoreSummary,
} from "@/lib/recommendation-service";
import { buildStoreListStatusPill } from "@/lib/store-pricing-status-copy";

const FRESHNESS_WINDOW_HOURS = 24;

export type PipelineDebugStore = {
  id: string;
  name: string;
  chain: StoreChain;
  chainLabel: string;
  distanceMiles: number;
  recommendationEnabled: boolean;
  rolloutStatus: ProviderRolloutStatus;
  trustBadge: string;
};

export type PipelineDebugPriceObservation = {
  storeId: string;
  ingredientId: string;
  price: number;
  sourceName: string | null;
  observedAt: string;
  confidenceScore: number | null;
  saleLabel: string | null;
  validThrough: string | null;
  freshnessHoursAgo: number;
};

export type PipelineFreshnessSummary = {
  observationCount: number;
  freshWithin24Hours: number;
  staleCount: number;
  countsBySource: Record<string, number>;
};

export type PipelineDebugResponse = {
  ok: true;
  zipCode: string | null;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  locationLabel: string;
  dataSource: "database" | "unavailable";
  nearbyStores: PipelineDebugStore[];
  priceObservations: PipelineDebugPriceObservation[];
  freshnessSummary: PipelineFreshnessSummary;
  missingIngredientIds: string[];
  trackedIngredientIds: string[];
};

function mapNearbyStoreForDebug(store: NearbyStoreSummary): PipelineDebugStore {
  return {
    id: store.id,
    name: store.name,
    chain: store.chain,
    chainLabel: store.chainLabel,
    distanceMiles: store.distanceMiles,
    recommendationEnabled: store.recommendationEnabled,
    rolloutStatus: store.rolloutStatus,
    trustBadge: buildStoreListStatusPill({
      recommendationEnabled: store.recommendationEnabled,
      rolloutStatus: store.rolloutStatus,
      chain: store.chain,
    }),
  };
}

function buildFreshnessSummary(
  observations: PipelineDebugPriceObservation[],
): PipelineFreshnessSummary {
  const countsBySource: Record<string, number> = {};
  let freshWithin24Hours = 0;
  let staleCount = 0;

  for (const observation of observations) {
    const sourceKey = observation.sourceName ?? "unknown";
    countsBySource[sourceKey] = (countsBySource[sourceKey] ?? 0) + 1;

    if (observation.freshnessHoursAgo < FRESHNESS_WINDOW_HOURS) {
      freshWithin24Hours += 1;
    } else {
      staleCount += 1;
    }
  }

  return {
    observationCount: observations.length,
    freshWithin24Hours,
    staleCount,
    countsBySource,
  };
}

function buildMissingIngredientIds(input: {
  trackedIngredientIds: string[];
  nearbyStoreIds: Set<string>;
  observations: PipelineDebugPriceObservation[];
}) {
  const observedIngredientIds = new Set(
    input.observations
      .filter((observation) => input.nearbyStoreIds.has(observation.storeId))
      .map((observation) => observation.ingredientId),
  );

  return input.trackedIngredientIds.filter(
    (ingredientId) => !observedIngredientIds.has(ingredientId),
  );
}

export async function getPipelineDebugView(input: {
  location: ResolvedSearchLocation;
  radiusMiles: number;
}): Promise<PipelineDebugResponse> {
  const previewTrackedIngredients = await resolveKrogerPreviewTrackedIngredients();
  const trackedIngredientIds = previewTrackedIngredients.map(
    (ingredient) => ingredient.ingredientId,
  );

  const [pricingContext, recipeCatalog] = await Promise.all([
    getMarketPricingContext(),
    getRecipeCatalog(),
  ]);

  const recipeIngredientIds = collectRecipeIngredientIdsForRollout(
    recipeCatalog.recipes,
  );

  const nearbyStoreSummaries =
    pricingContext.source === "database"
      ? buildNearbyStoresForSearch(
          pricingContext.stores,
          input.location,
          input.radiusMiles,
          pricingContext.priceObservations,
          recipeIngredientIds,
        )
      : [];

  const nearbyStores = nearbyStoreSummaries.map(mapNearbyStoreForDebug);
  const nearbyStoreIds = new Set(nearbyStores.map((store) => store.id));

  let priceObservations: PipelineDebugPriceObservation[] = [];

  if (pricingContext.source === "database") {
    const rows = await getRankedPriceObservationsWithTimestamps();
    priceObservations = rows
      .filter((row) => nearbyStoreIds.has(row.store_id))
      .map((row) => ({
        storeId: row.store_id,
        ingredientId: row.ingredient_id,
        sourceName: row.source_name,
        price: Number(row.price),
        observedAt: row.observed_at.toISOString(),
        confidenceScore:
          row.confidence_score !== null && row.confidence_score !== undefined
            ? Number(row.confidence_score)
            : null,
        saleLabel: row.sale_label,
        validThrough: row.valid_through?.toISOString() ?? null,
        freshnessHoursAgo: row.freshness_hours_ago,
      }))
      .sort((left, right) => {
        const storeCompare = left.storeId.localeCompare(right.storeId);
        if (storeCompare !== 0) {
          return storeCompare;
        }
        return left.ingredientId.localeCompare(right.ingredientId);
      });
  }

  const locationLabel =
    input.location.source === "browser"
      ? "Current location"
      : `${input.location.city}, ${input.location.state}`;

  return {
    ok: true,
    zipCode: input.location.zipCode ?? null,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    radiusMiles: input.radiusMiles,
    locationLabel,
    dataSource: pricingContext.source,
    nearbyStores,
    priceObservations,
    freshnessSummary: buildFreshnessSummary(priceObservations),
    trackedIngredientIds,
    missingIngredientIds: buildMissingIngredientIds({
      trackedIngredientIds,
      nearbyStoreIds,
      observations: priceObservations,
    }),
  };
}
