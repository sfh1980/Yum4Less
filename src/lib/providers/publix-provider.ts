import {
  getProviderPricingPreviewLabel,
  getProviderStoreDiscoveryLabel,
} from "@/lib/providers/provider-labels";
import {
  createPublixServicesApiClient,
  parsePublixStoreNumber,
} from "@/lib/providers/publix/publix-services-api-client";
import type { PublixStoreRecord } from "@/lib/providers/publix/publix-services-api-types";
import type {
  ProviderDiscoveredStore,
  ProviderPricingPreviewInput,
  ProviderPricingPreviewResult,
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProviderClient,
} from "@/lib/providers/provider-types";

export function createPublixProviderClient(): StoreDiscoveryProviderClient {
  const label = getProviderStoreDiscoveryLabel("publix");
  const pricingPreviewLabel = getProviderPricingPreviewLabel("publix");
  const api = createPublixServicesApiClient();

  return {
    provider: "publix",
    label,
    configured: true,
    async searchStoresByLocation(
      input: ProviderStoreSearchInput,
    ): Promise<ProviderStoreSearchResult> {
      const zipCode = input.location.zipCode?.trim();
      if (!zipCode) {
        return {
          provider: "publix",
          label,
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: true,
          fallbackUsed: true,
          stores: [],
          message:
            "Publix store discovery needs a ZIP code before it can query the website store-locator service.",
          fetchedAt: new Date().toISOString(),
        };
      }

      try {
        const stores = await api.searchStoresByZip({ zipCode, count: 10 });
        const normalizedStores = stores
          .map(toProviderDiscoveredStore)
          .filter(
            (store): store is ProviderDiscoveredStore & { distanceMiles: number } =>
              store !== undefined && store.distanceMiles <= input.radiusMiles,
          )
          .sort((left, right) => left.distanceMiles - right.distanceMiles);

        return {
          provider: "publix",
          label,
          status: "available",
          provenance: "website-service",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          stores: normalizedStores,
          message:
            normalizedStores.length > 0
              ? `Publix store discovery found ${normalizedStores.length} nearby store(s) via the website store-locator service. Publix has no developer API; product and weekly-ad pricing would require a third-party path such as Apify. These results support discovery only and do not drive ranked meal pricing.`
              : "Publix store discovery is configured, but no nearby Publix stores were returned for this ZIP and radius.",
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        return {
          provider: "publix",
          label,
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: true,
          fallbackUsed: true,
          stores: [],
          message:
            error instanceof Error
              ? `Publix store discovery was attempted but fell back to local store coverage: ${error.message}`
              : "Publix store discovery was attempted but fell back to local store coverage.",
          fetchedAt: new Date().toISOString(),
        };
      }
    },
    async searchPricingPreview(
      input: ProviderPricingPreviewInput,
    ): Promise<ProviderPricingPreviewResult> {
      return {
        provider: "publix",
        label: pricingPreviewLabel,
        status: "not-configured",
        provenance: "not-configured",
        retrievalMode: "none",
        configured: false,
        fallbackUsed: false,
        storeName: input.store.name,
        providerStoreId: input.store.providerStoreId,
        items: [],
        coverageStatus: "none",
        matchedIngredientCount: 0,
        totalTrackedIngredients: input.ingredients.length,
        message:
          "Publix pricing preview is not active yet. Publix does not offer a direct developer API; the most common third-party path is an Apify actor for store/product/weekly-ad data. That integration is not wired in this MVP, and ranked meal pricing stays on trusted seed/DB data.",
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}

function toProviderDiscoveredStore(
  store: PublixStoreRecord,
): (ProviderDiscoveredStore & { distanceMiles: number }) | undefined {
  const latitude = store.CLAT ? Number.parseFloat(store.CLAT) : Number.NaN;
  const longitude = store.CLON ? Number.parseFloat(store.CLON) : Number.NaN;
  const providerStoreId = store.KEY ?? String(parsePublixStoreNumber(store.KEY) ?? "");
  const distanceMiles = store.DISTANCE ? Number.parseFloat(store.DISTANCE) : Number.NaN;

  if (
    !providerStoreId ||
    !store.NAME ||
    !store.CITY ||
    !store.STATE ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(distanceMiles)
  ) {
    return undefined;
  }

  return {
    provider: "publix",
    providerStoreId,
    name: store.NAME,
    addressLine1: store.ADDR,
    city: store.CITY,
    state: store.STATE,
    zipCode: store.ZIP,
    latitude,
    longitude,
    distanceMiles,
  };
}
