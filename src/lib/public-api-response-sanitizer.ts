import type { MarketSummary, NearbyStoreSummary } from "@/lib/recommendation-service";
import type { ProviderPriceObservationSyncSummary } from "@/lib/provider-price-observation-sync";
import type {
  ProviderDiscoveredStore,
  ProviderPricingPreviewItem,
  ProviderPricingPreviewResult,
  ProviderStoreSearchResult,
} from "@/lib/providers/provider-types";
import type { WeeklyAdPromotionReadiness } from "@/lib/weekly-ad-ingestion/weekly-ad-promotion-readiness";
import type { WeeklyAdIngestionStatusSummary } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type PublicMarketSummary = Omit<
  MarketSummary,
  | "message"
  | "nearbyStores"
  | "providerStoreSearches"
  | "providerPricingPreviews"
  | "providerPriceObservationSync"
  | "weeklyAdIngestionStatus"
  | "weeklyAdPromotionReadiness"
> & {
  nearbyStores: NearbyStoreSummary[];
  providerStoreSearches: PublicProviderStoreSearchResult[];
  providerPricingPreviews: PublicProviderPricingPreviewResult[];
  providerPriceObservationSync: PublicProviderPriceObservationSyncSummary[];
  weeklyAdIngestionStatus: PublicWeeklyAdIngestionStatusSummary[];
  weeklyAdPromotionReadiness: PublicWeeklyAdPromotionReadiness[];
};

type PublicProviderDiscoveredStore = Omit<ProviderDiscoveredStore, "providerStoreId">;

type PublicProviderStoreSearchResult = Omit<
  ProviderStoreSearchResult,
  "persistedSnapshotId" | "stores"
> & {
  stores: PublicProviderDiscoveredStore[];
};

type PublicProviderPricingPreviewResult = Omit<
  ProviderPricingPreviewResult,
  "persistedSnapshotId" | "providerStoreId" | "items"
> & {
  items: PublicProviderPricingPreviewItem[];
};
type PublicProviderPricingPreviewItem = Omit<
  ProviderPricingPreviewItem,
  "providerProductId"
>;

type PublicProviderPriceObservationSyncSummary = Omit<
  ProviderPriceObservationSyncSummary,
  "internalStoreId"
> & {
  message: string;
};

type PublicWeeklyAdIngestionStatusSummary = Omit<
  WeeklyAdIngestionStatusSummary,
  "storeId" | "sourceName"
> & {
  message: string;
};
type PublicWeeklyAdPromotionReadiness = Omit<WeeklyAdPromotionReadiness, "storeId">;

export function sanitizeMarketSummaryForPublicApi(
  market: MarketSummary,
): PublicMarketSummary {
  const { message: _retiredMessage, ...marketWithoutMessage } = market;

  return {
    ...marketWithoutMessage,
    nearbyStores: market.nearbyStores.map(sanitizeNearbyStoreForPublicApi),
    providerStoreSearches: market.providerStoreSearches.map(
      sanitizeProviderStoreSearchForPublicApi,
    ),
    providerPricingPreviews: market.providerPricingPreviews.map(
      sanitizeProviderPricingPreviewForPublicApi,
    ),
    providerPriceObservationSync: market.providerPriceObservationSync.map(
      sanitizeProviderPriceObservationSyncForPublicApi,
    ),
    weeklyAdIngestionStatus: market.weeklyAdIngestionStatus.map(
      sanitizeWeeklyAdIngestionStatusForPublicApi,
    ),
    weeklyAdPromotionReadiness: (market.weeklyAdPromotionReadiness ?? []).map(
      sanitizeWeeklyAdPromotionReadinessForPublicApi,
    ),
  };
}

function sanitizeNearbyStoreForPublicApi(
  store: NearbyStoreSummary,
): Omit<NearbyStoreSummary, "sourceStoreId"> {
  const { sourceStoreId: _sourceStoreId, ...publicStore } = store;
  return publicStore;
}

function sanitizeProviderStoreSearchForPublicApi(
  search: ProviderStoreSearchResult,
): PublicProviderStoreSearchResult {
  const { persistedSnapshotId: _persistedSnapshotId, stores, ...rest } = search;
  return {
    ...rest,
    stores: stores.map(sanitizeProviderDiscoveredStoreForPublicApi),
  };
}

function sanitizeProviderDiscoveredStoreForPublicApi(
  store: ProviderDiscoveredStore,
): PublicProviderDiscoveredStore {
  const { providerStoreId: _providerStoreId, ...rest } = store;
  return rest;
}

function sanitizeProviderPricingPreviewForPublicApi(
  preview: ProviderPricingPreviewResult,
): PublicProviderPricingPreviewResult {
  const {
    persistedSnapshotId: _persistedSnapshotId,
    providerStoreId: _providerStoreId,
    items,
    ...rest
  } = preview;
  return {
    ...rest,
    items: (items ?? []).map(sanitizeProviderPricingPreviewItemForPublicApi),
  };
}

function sanitizeProviderPricingPreviewItemForPublicApi(
  item: ProviderPricingPreviewItem,
): PublicProviderPricingPreviewItem {
  const { providerProductId: _providerProductId, ...rest } = item;
  return rest;
}

function sanitizeProviderPriceObservationSyncForPublicApi(
  summary: ProviderPriceObservationSyncSummary,
): PublicProviderPriceObservationSyncSummary {
  const { internalStoreId: _internalStoreId, ...rest } = summary;
  return {
    ...rest,
    message: redactInternalStoreIds(rest.message, [summary.internalStoreId]),
  };
}

function sanitizeWeeklyAdIngestionStatusForPublicApi(
  summary: WeeklyAdIngestionStatusSummary,
): PublicWeeklyAdIngestionStatusSummary {
  const { storeId: _storeId, sourceName: _sourceName, ...rest } = summary;
  return {
    ...rest,
    message: redactInternalStoreIds(rest.message, [
      summary.storeId,
      summary.sourceName,
    ]),
  };
}

function sanitizeWeeklyAdPromotionReadinessForPublicApi(
  readiness: WeeklyAdPromotionReadiness,
): PublicWeeklyAdPromotionReadiness {
  const { storeId: _storeId, ...rest } = readiness;
  return rest;
}

const PUBLIC_STORE_PLACEHOLDER = "the selected store";

/**
 * OSM / SNAP / fixture catalog ids, plus kebab tokens that include a digit
 * (`kroger-02900511`, `publix-1626`). Does not match English hyphens like
 * `all-time` or `weekly-ad`.
 */
const LEFTOVER_CATALOG_IDENTITY_RE =
  /\b(?:osm-(?:way|node|relation)-\d+|fixture-osm-[a-z0-9-]+|snap-[a-z0-9-]+|[a-z][a-z0-9]*-(?:[a-z0-9]*\d[a-z0-9]*)(?:-[a-z0-9]+)*)\b/gi;

function uniqueLongestFirst(
  values: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    const id = value?.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids.sort((left, right) => right.length - left.length);
}

/**
 * Hide internal store / source ids in diagnostic sentences. Replace only known
 * identifiers (and leftover catalog-shaped tokens), not every hyphenated word.
 */
export function redactInternalStoreIds(
  message: string,
  knownInternalIds: readonly (string | null | undefined)[] = [],
): string {
  let redacted = message;
  for (const id of uniqueLongestFirst(knownInternalIds)) {
    redacted = redacted.split(id).join(PUBLIC_STORE_PLACEHOLDER);
  }
  return redacted.replace(LEFTOVER_CATALOG_IDENTITY_RE, PUBLIC_STORE_PLACEHOLDER);
}
