import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import {
  getLatestProviderStoreSearchSnapshot,
  persistProviderStoreSearchResult,
} from "@/lib/provider-store-search-cache";
import { getStoreDiscoveryProviders } from "@/lib/providers/provider-registry";
import type {
  ProviderStoreSearchInput,
  ProviderStoreSearchResult,
  StoreDiscoveryProviderClient,
} from "@/lib/providers/provider-types";
import {
  rankedPriceCacheMissMessage,
  type ProviderDataReadMode,
} from "@/lib/ranked-price-cache-policy";

export async function searchOfficialProviderStores(input: {
  location: ResolvedSearchLocation;
  radiusMiles: number;
  readMode?: ProviderDataReadMode;
}): Promise<ProviderStoreSearchResult[]> {
  const readMode = input.readMode ?? "cache-only";
  const providers = getStoreDiscoveryProviders();

  return Promise.all(
    providers.map(async (provider) => {
      const searchInput: ProviderStoreSearchInput = {
        location: input.location,
        radiusMiles: input.radiusMiles,
      };

      if (readMode === "cache-only") {
        const cachedSnapshot = await getLatestProviderStoreSearchSnapshot({
          provider: provider.provider,
          search: searchInput,
        });

        if (cachedSnapshot) {
          return cachedSnapshot;
        }

        return buildCacheMissStoreSearchFallback(provider);
      }

      const result = await provider.searchStoresByLocation(searchInput);

      if (result.status !== "available") {
        const cachedSnapshot = await getLatestProviderStoreSearchSnapshot({
          provider: provider.provider,
          search: searchInput,
        });

        if (cachedSnapshot) {
          return cachedSnapshot;
        }
      }

      const persistedSnapshotId = isPublicApiDbWriteEnabled()
        ? await persistProviderStoreSearchResult(searchInput, result)
        : undefined;

      return {
        ...result,
        ...(persistedSnapshotId !== undefined ? { persistedSnapshotId } : {}),
      };
    }),
  );
}

function buildCacheMissStoreSearchFallback(
  provider: Pick<StoreDiscoveryProviderClient, "provider" | "label" | "configured">,
): ProviderStoreSearchResult {
  return {
    provider: provider.provider,
    label: provider.label,
    status: "fallback",
    provenance: "fallback-local",
    retrievalMode: "none",
    configured: provider.configured,
    fallbackUsed: true,
    stores: [],
    message: rankedPriceCacheMissMessage("provider store discovery snapshot"),
    fetchedAt: new Date().toISOString(),
  };
}
