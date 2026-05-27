import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import {
  getLatestProviderStoreSearchSnapshot,
  persistProviderStoreSearchResult,
} from "@/lib/provider-store-search-cache";
import { getStoreDiscoveryProviders } from "@/lib/providers/provider-registry";
import type { ProviderStoreSearchResult } from "@/lib/providers/provider-types";

export async function searchOfficialProviderStores(input: {
  location: ResolvedSearchLocation;
  radiusMiles: number;
}): Promise<ProviderStoreSearchResult[]> {
  const providers = getStoreDiscoveryProviders();

  return Promise.all(
    providers.map(async (provider) => {
      const searchInput = {
        location: input.location,
        radiusMiles: input.radiusMiles,
      };
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
