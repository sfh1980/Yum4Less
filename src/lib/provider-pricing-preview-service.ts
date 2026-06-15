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
  ProviderPricingPreviewIngredient,
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
  preferredProviderStoreId?: string,
): ProviderDiscoveredStore | undefined {
  const candidates = providerStores.filter((store) => store.provider === provider);
  if (candidates.length === 0) {
    return undefined;
  }

  if (preferredProviderStoreId) {
    const preferred = candidates.find(
      (store) => store.providerStoreId === preferredProviderStoreId,
    );
    if (preferred) {
      return preferred;
    }
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
  preferredProviderStoreIds?: Partial<
    Record<ProviderDiscoveredStore["provider"], string>
  >;
  /** TODO(provider-search-terms): Only the sync script passes DB-backed terms today. */
  trackedIngredients?: ProviderPricingPreviewIngredient[];
}): Promise<ProviderPricingPreviewResult[]> {
  const readMode = input.readMode ?? "cache-only";
  const trackedIngredients = input.trackedIngredients ?? PROVIDER_TRACKED_INGREDIENTS;
  const providers = getStoreDiscoveryProviders();

  return Promise.all(
    providers.map(async (provider) => {
      const matchingStore = selectProviderDiscoveredStore(
        provider.provider,
        input.providerStores,
        input.preferredProviderStoreIds?.[provider.provider],
      );

      if (!matchingStore) {
        return buildNoMatchedStorePreview(provider, trackedIngredients.length);
      }

      if (readMode === "cache-only") {
        const cachedSnapshot = await getLatestProviderPricingPreviewSnapshot({
          provider: provider.provider,
          providerStoreId: matchingStore.providerStoreId,
        });

        if (cachedSnapshot) {
          return cachedSnapshot;
        }

        return buildCacheMissPricingPreviewFallback(
          provider,
          matchingStore,
          trackedIngredients.length,
        );
      }

      const result = await provider.searchPricingPreview({
        store: matchingStore,
        ingredients: trackedIngredients,
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
              ingredients: trackedIngredients,
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
  trackedIngredientCount: number,
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
    totalTrackedIngredients: trackedIngredientCount,
    message:
      "No official provider store was available for pricing preview in this search, so Yum4Less did not run provider-backed product matching.",
    fetchedAt: new Date().toISOString(),
  };
}

function buildCacheMissPricingPreviewFallback(
  provider: Pick<StoreDiscoveryProviderClient, "provider" | "configured">,
  matchingStore: ProviderDiscoveredStore,
  trackedIngredientCount: number,
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
    totalTrackedIngredients: trackedIngredientCount,
    message: rankedPriceCacheMissMessage("provider pricing preview"),
    fetchedAt: new Date().toISOString(),
  };
}
