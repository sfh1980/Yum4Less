import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import {
  getLatestProviderPricingPreviewSnapshot,
  persistProviderPricingPreviewResult,
} from "@/lib/provider-product-pricing-cache";
import { PROVIDER_TRACKED_INGREDIENTS } from "@/lib/provider-tracked-ingredients";
import { getProviderPricingPreviewLabel } from "@/lib/providers/provider-labels";
import { getStoreDiscoveryProviders } from "@/lib/providers/provider-registry";
import type {
  ProviderDiscoveredStore,
  ProviderPricingPreviewResult,
} from "@/lib/providers/provider-types";

export async function buildProviderPricingPreviews(input: {
  providerStores: ProviderDiscoveredStore[];
}): Promise<ProviderPricingPreviewResult[]> {
  const providers = getStoreDiscoveryProviders();

  return Promise.all(
    providers.map(async (provider) => {
      const matchingStore = input.providerStores.find(
        (store) => store.provider === provider.provider,
      );

      if (!matchingStore) {
        return {
          provider: provider.provider,
          label: getProviderPricingPreviewLabel(provider.provider),
          status: "fallback",
          provenance: "fallback-local",
          retrievalMode: "none",
          configured: provider.configured,
          fallbackUsed: true,
          storeName: "No matched provider store",
          providerStoreId: "unavailable",
          items: [],
          coverageStatus: "none",
          matchedIngredientCount: 0,
          totalTrackedIngredients: PROVIDER_TRACKED_INGREDIENTS.length,
          message:
            "No official provider store was available for pricing preview in this search, so Yum4Less did not run provider-backed product matching.",
          fetchedAt: new Date().toISOString(),
        };
      }

      const result = await provider.searchPricingPreview({
        store: matchingStore,
        ingredients: PROVIDER_TRACKED_INGREDIENTS,
      });

      if (result.status !== "available") {
        const cachedSnapshot = await getLatestProviderPricingPreviewSnapshot({
          provider: provider.provider,
          providerStoreId: matchingStore.providerStoreId,
        });

        if (cachedSnapshot) {
          return cachedSnapshot;
        }
      }

      const persistedSnapshotId = isPublicApiDbWriteEnabled()
        ? await persistProviderPricingPreviewResult(
            {
              store: matchingStore,
              ingredients: PROVIDER_TRACKED_INGREDIENTS,
            },
            result,
          )
        : undefined;

      return {
        ...result,
        ...(persistedSnapshotId !== undefined ? { persistedSnapshotId } : {}),
      };
    }),
  );
}
