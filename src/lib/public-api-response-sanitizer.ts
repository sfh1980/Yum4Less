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
  index: number,
): NearbyStoreSummary {
  const { id: _id, ...rest } = store;
  return {
    ...rest,
    id: `store-${index + 1}`,
  };
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
    message: redactInternalStoreIds(rest.message),
  };
}

function sanitizeWeeklyAdIngestionStatusForPublicApi(
  summary: WeeklyAdIngestionStatusSummary,
): PublicWeeklyAdIngestionStatusSummary {
  const { storeId: _storeId, sourceName: _sourceName, ...rest } = summary;
  return {
    ...rest,
    message: redactInternalStoreIds(rest.message),
  };
}

function sanitizeWeeklyAdPromotionReadinessForPublicApi(
  readiness: WeeklyAdPromotionReadiness,
): PublicWeeklyAdPromotionReadiness {
  const { storeId: _storeId, ...rest } = readiness;
  return rest;
}

function redactInternalStoreIds(message: string): string {
  return message.replace(/\b[a-z0-9]+(?:-[a-z0-9]+)+\b/gi, "the selected store");
}
