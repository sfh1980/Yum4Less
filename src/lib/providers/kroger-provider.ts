import {
  createKrogerApiClient,
  readKrogerApiCredentialsFromEnv,
} from "@/lib/providers/kroger/kroger-api-client";
import {
  getKrogerApiEnvironment,
  isKrogerOfficialOnlinePricingEligible,
  isKrogerProductAvailableInStore,
  readKrogerItemPrices,
  type KrogerLocation,
} from "@/lib/providers/kroger/kroger-api-types";
import type {
  ProviderDiscoveredStore,
  ProviderPricingPreviewInput,
  ProviderPricingPreviewItem,
  ProviderPricingPreviewResult,
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProviderClient,
} from "@/lib/providers/provider-types";
import {
  buildPricingCoverageMessage,
  getPricingCoverageStatus,
  scoreProviderProductMatch,
} from "@/lib/providers/provider-price-matching";

const KROGER_LABEL = "Kroger official store discovery";

export function createKrogerProviderClient(): StoreDiscoveryProviderClient {
  const credentials = readKrogerApiCredentialsFromEnv();
  const api = createKrogerApiClient(credentials);
  const configured = api.isConfigured;

  return {
    provider: "kroger",
    label: KROGER_LABEL,
    configured,
    async searchStoresByLocation(
      input: ProviderStoreSearchInput,
    ): Promise<ProviderStoreSearchResult> {
      if (!configured || !credentials) {
        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "not-configured",
          provenance: "not-configured",
          retrievalMode: "none",
          configured: false,
          fallbackUsed: false,
          stores: [],
          message:
            "Kroger official store discovery is not configured yet. Add Kroger API credentials to enable live nearby-store checks.",
          fetchedAt: new Date().toISOString(),
        };
      }

      try {
        const locations = await api.searchLocations({
          latLongNear: `${input.location.latitude},${input.location.longitude}`,
          radiusInMiles: input.radiusMiles,
          limit: 10,
          chain: "Kroger",
        });
        const stores = locations
          .map(toProviderDiscoveredStore)
          .filter(
            (store): store is ProviderDiscoveredStore => store !== undefined,
          );

        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          stores,
          message:
            stores.length > 0
              ? `Kroger official store discovery found ${stores.length} nearby store(s). These results support discovery only for now and do not yet drive ranked meal pricing.`
              : "Kroger official store discovery is configured, but no nearby Kroger stores were returned for this search.",
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        return {
          provider: "kroger",
          label: KROGER_LABEL,
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: true,
          fallbackUsed: true,
          stores: [],
          message:
            error instanceof Error
              ? `Kroger official store discovery was attempted but fell back to local store coverage: ${error.message}`
              : "Kroger official store discovery was attempted but fell back to local store coverage.",
          fetchedAt: new Date().toISOString(),
        };
      }
    },
    async searchPricingPreview(
      input: ProviderPricingPreviewInput,
    ): Promise<ProviderPricingPreviewResult> {
      if (!configured || !credentials) {
        return {
          provider: "kroger",
          label: KROGER_LABEL,
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
            "Kroger official pricing preview is not configured yet. Add Kroger API credentials to enable provider-backed product lookups.",
          fetchedAt: new Date().toISOString(),
        };
      }

      try {
        const environment = getKrogerApiEnvironment();
        const rawItems = await searchKrogerProductsForIngredients(api, input);
        const items = isKrogerOfficialOnlinePricingEligible()
          ? rawItems.filter((item) => hasKrogerPreviewPrice(item))
          : [];
        const coverageStatus = getPricingCoverageStatus({
          matchedIngredientCount: items.length,
          totalTrackedIngredients: input.ingredients.length,
        });

        if (!isKrogerOfficialOnlinePricingEligible()) {
          return {
            provider: "kroger",
            label: "Kroger official pricing preview",
            status: "available",
            provenance: "official-api",
            retrievalMode: "live",
            configured: true,
            fallbackUsed: false,
            storeName: input.store.name,
            providerStoreId: input.store.providerStoreId,
            coverageStatus: "none",
            matchedIngredientCount: 0,
            totalTrackedIngredients: input.ingredients.length,
            items: [],
            message:
              environment === "certification"
                ? "Kroger catalog lookup works in certification, but store-specific prices require production (api.kroger.com). Set KROGER_API_ENV=production after Kroger approves portal promotion, then re-run npm run test:kroger-api."
                : "Kroger official-online pricing preview requires KROGER_API_ENV=production.",
            fetchedAt: new Date().toISOString(),
          };
        }

        if (items.length === 0) {
          return {
            provider: "kroger",
            label: "Kroger official pricing preview",
            status: "available",
            provenance: "official-api",
            retrievalMode: "live",
            configured: true,
            fallbackUsed: false,
            storeName: input.store.name,
            providerStoreId: input.store.providerStoreId,
            coverageStatus: "none",
            matchedIngredientCount: 0,
            totalTrackedIngredients: input.ingredients.length,
            items: [],
            message:
              "Kroger production API auth succeeded, but the sample product lookups did not return store prices yet. Weekly-ad and cached rows remain the ranked path until prices appear—verify any returned price in store before checkout.",
            fetchedAt: new Date().toISOString(),
          };
        }

        return {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          configured: true,
          fallbackUsed: false,
          storeName: input.store.name,
          providerStoreId: input.store.providerStoreId,
          coverageStatus,
          matchedIngredientCount: items.length,
          totalTrackedIngredients: input.ingredients.length,
          items,
          message: `${buildPricingCoverageMessage({
            matchedIngredientCount: items.length,
            totalTrackedIngredients: input.ingredients.length,
            coverageStatus,
          })} Prices came from the official Kroger production API—verify in store before checkout.`,
          fetchedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        return {
          provider: "kroger",
          label: "Kroger official pricing preview",
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: true,
          fallbackUsed: true,
          storeName: input.store.name,
          providerStoreId: input.store.providerStoreId,
          items: [],
          coverageStatus: "none",
          matchedIngredientCount: 0,
          totalTrackedIngredients: input.ingredients.length,
          message:
            error instanceof Error
              ? `Kroger official pricing preview fell back before using provider prices: ${error.message}`
              : "Kroger official pricing preview fell back before using provider prices.",
          fetchedAt: new Date().toISOString(),
        };
      }
    },
  };
}

function toProviderDiscoveredStore(
  item: KrogerLocation,
): ProviderDiscoveredStore | undefined {
  const latitude = item.geolocation?.latitude;
  const longitude = item.geolocation?.longitude;
  const address = item.address;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !item.locationId ||
    !item.name ||
    !address?.city ||
    !address.state
  ) {
    return undefined;
  }

  return {
    provider: "kroger",
    providerStoreId: item.locationId,
    name: item.name,
    addressLine1: address.addressLine1,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    latitude,
    longitude,
  };
}

async function searchKrogerProductsForIngredients(
  api: ReturnType<typeof createKrogerApiClient>,
  input: ProviderPricingPreviewInput,
): Promise<ProviderPricingPreviewItem[]> {
  const results = await Promise.all(
    input.ingredients.map((ingredient) =>
      searchKrogerProduct(api, input.store.providerStoreId, ingredient),
    ),
  );

  return results.filter(
    (item): item is ProviderPricingPreviewItem => item !== undefined,
  );
}

async function searchKrogerProduct(
  api: ReturnType<typeof createKrogerApiClient>,
  providerStoreId: string,
  ingredient: ProviderPricingPreviewInput["ingredients"][number],
): Promise<ProviderPricingPreviewItem | undefined> {
  const products = await api.searchProducts({
    term: ingredient.searchTerm,
    locationId: providerStoreId,
    fulfillment: "ais",
    limit: 3,
  });

  const candidateMatches = products
    .map((product): ProviderPricingPreviewItem | undefined => {
      if (!product.productId || !product.description) {
        return undefined;
      }

      const firstItem = product.items?.[0];
      const { regularPrice, promoPrice } = readKrogerItemPrices(firstItem);
      const inStock = isKrogerProductAvailableInStore(firstItem);
      const matchMetadata = scoreProviderProductMatch({
        ingredient,
        description: product.description,
        inStock,
      });

      return {
        provider: "kroger" as const,
        ingredientId: ingredient.ingredientId,
        ingredientName: ingredient.ingredientName,
        providerProductId: product.productId,
        description: product.description,
        brand: product.brand,
        regularPrice,
        promoPrice,
        currencyCode: "USD",
        inStock,
        matchConfidence: matchMetadata.matchConfidence,
        matchReason: matchMetadata.matchReason,
      };
    })
    .filter(
      (item): item is ProviderPricingPreviewItem =>
        item !== undefined && item.matchConfidence >= 0.45,
    )
    .sort((left, right) => right.matchConfidence - left.matchConfidence);

  return candidateMatches[0];
}

function hasKrogerPreviewPrice(item: ProviderPricingPreviewItem) {
  return typeof item.promoPrice === "number" || typeof item.regularPrice === "number";
}
