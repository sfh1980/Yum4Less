import {
  getProviderPricingPreviewLabel,
  getProviderStoreDiscoveryLabel,
} from "@/lib/providers/provider-labels";
import type {
  ProviderPricingPreviewInput,
  ProviderPricingPreviewResult,
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProviderClient,
} from "@/lib/providers/provider-types";

export function createWalmartProviderClient(): StoreDiscoveryProviderClient {
  const clientId = process.env.WALMART_CLIENT_ID?.trim();
  const clientSecret = process.env.WALMART_CLIENT_SECRET?.trim();
  const configured = Boolean(clientId && clientSecret);
  const label = getProviderStoreDiscoveryLabel("walmart");
  const pricingPreviewLabel = getProviderPricingPreviewLabel("walmart");

  return {
    provider: "walmart",
    label,
    configured,
    async searchStoresByLocation(
      _input: ProviderStoreSearchInput,
    ): Promise<ProviderStoreSearchResult> {
      return {
        provider: "walmart",
        label,
        status: "not-configured",
        provenance: "not-configured",
        retrievalMode: "none",
        configured,
        fallbackUsed: false,
        stores: [],
        message: configured
          ? "Walmart API credentials are configured, but Yum4Less has not wired an approved official API path yet. Walmart pins stay nearby context only and are excluded from ranked meal pricing."
          : "Walmart official store discovery is not configured yet. Walmart appears on the map for nearby context only; live, current Walmart pricing is not available for ranked dinners in this MVP.",
        fetchedAt: new Date().toISOString(),
      };
    },
    async searchPricingPreview(
      input: ProviderPricingPreviewInput,
    ): Promise<ProviderPricingPreviewResult> {
      return {
        provider: "walmart",
        label: pricingPreviewLabel,
        status: "not-configured",
        provenance: "not-configured",
        retrievalMode: "none",
        configured,
        fallbackUsed: false,
        storeName: input.store.name,
        providerStoreId: input.store.providerStoreId,
        items: [],
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: input.ingredients.length,
        message: configured
          ? "Walmart API credentials are configured, but official pricing preview is not wired yet. Walmart is excluded from ranked meal pricing until live data is available."
          : "Walmart official pricing preview is not active yet. Live, actionable Walmart prices are not available for ranked dinners in this MVP.",
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
