import type { MarketSummary } from "@/lib/recommendation-service";
import type { ProviderPriceObservationSyncSummary } from "@/lib/provider-price-observation-sync";
import type {
  ProviderPricingPreviewResult,
  ProviderStoreSearchResult,
} from "@/lib/providers/provider-types";

export function sanitizeMarketSummaryForPublicApi(
  market: MarketSummary,
): Omit<MarketSummary, "message"> {
  const { message: _retiredMessage, ...marketWithoutMessage } = market;

  return {
    ...marketWithoutMessage,
    providerStoreSearches: market.providerStoreSearches.map(
      sanitizeProviderStoreSearchForPublicApi,
    ),
    providerPricingPreviews: market.providerPricingPreviews.map(
      sanitizeProviderPricingPreviewForPublicApi,
    ),
    providerPriceObservationSync: market.providerPriceObservationSync.map(
      sanitizeProviderPriceObservationSyncForPublicApi,
    ),
  };
}

function sanitizeProviderStoreSearchForPublicApi(
  search: ProviderStoreSearchResult,
): ProviderStoreSearchResult {
  const { persistedSnapshotId: _persistedSnapshotId, ...rest } = search;
  return rest;
}

function sanitizeProviderPricingPreviewForPublicApi(
  preview: ProviderPricingPreviewResult,
): ProviderPricingPreviewResult {
  const { persistedSnapshotId: _persistedSnapshotId, ...rest } = preview;
  return rest;
}

function sanitizeProviderPriceObservationSyncForPublicApi(
  summary: ProviderPriceObservationSyncSummary,
): ProviderPriceObservationSyncSummary {
  const { internalStoreId: _internalStoreId, ...rest } = summary;
  return rest;
}
