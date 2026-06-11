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
  StoreDiscoveryProvider,
  StoreDiscoveryProviderClient,
} from "@/lib/providers/provider-types";
import {
  rankedPriceCacheMissMessage,
  type ProviderDataReadMode,
} from "@/lib/ranked-price-cache-policy";

export function selectProviderDiscoveredStore(
  provider: StoreDiscoveryProvider,
  providerStores: ProviderDiscoveredStore[],
): ProviderDiscoveredStore | undefined {
  const candidates = providerStores.filter((store) => store.provider === provider);
  if (candidates.length === 0) {
    return undefined;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  const withDistance = candidates.filter(
    (store) => typeof store.distanceMiles === "number",
  );
  if (withDistance.length !== candidates.length) {
    return undefined;
  }

  return withDistance.reduce((closest, store) =>
    (store.distanceMiles ?? Number.POSITIVE_INFINITY) <
    (closest.distanceMiles ?? Number.POSITIVE_INFINITY)
      ? store
      : closest,
  );
}

export async function buildProviderPricingPreviews(input: {
  providerStores: ProviderDiscoveredStore[];
  readMode?: ProviderDataReadMode;
}): Promise<ProviderPricingPreviewResult[]> {
  const readMode = input.readMode ?? "cache-only";
  const providers = getStoreDiscoveryProviders();

  return Promise.all(
    providers.map(async (provider) => {
      const matchingStore = selectProviderDiscoveredStore(
        provider.provider,
        input.providerStores,
      );

      if (!matchingStore) {
        return buildNoMatchedStorePreview(provider);
      }

      if (readMode === "cache-only") {
        const cachedSnapshot = await getLatestProviderPricingPreviewSnapshot({
          provider: provider.provider,
          providerStoreId: matchingStore.providerStoreId,
        });

        if (cachedSnapshot) {
          return cachedSnapshot;
        }

        return buildCacheMissPricingPreviewFallback(provider, matchingStore);
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

function buildNoMatchedStorePreview(
  provider: Pick<StoreDiscoveryProviderClient, "provider" | "configured">,
): ProviderPricingPreviewResult {
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

function buildCacheMissPricingPreviewFallback(
  provider: Pick<StoreDiscoveryProviderClient, "provider" | "configured">,
  matchingStore: ProviderDiscoveredStore,
): ProviderPricingPreviewResult {
  return {
    provider: provider.provider,
    label: getProviderPricingPreviewLabel(provider.provider),
    status: "fallback",
    provenance: "fallback-local",
    retrievalMode: "none",
    configured: provider.configured,
    fallbackUsed: true,
    storeName: matchingStore.name,
    providerStoreId: matchingStore.providerStoreId,
    items: [],
    coverageStatus: "none",
    matchedIngredientCount: 0,
    totalTrackedIngredients: PROVIDER_TRACKED_INGREDIENTS.length,
    message: rankedPriceCacheMissMessage("provider pricing preview"),
    fetchedAt: new Date().toISOString(),
  };
}
