import { getProviderRolloutForCatalogStore } from "@/lib/provider-rollout";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  isWeeklyAdChain,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdIngestStoreCandidate = {
  id: string;
  name: string;
  chain: WeeklyAdChain;
  latitude: number;
  longitude: number;
};

/**
 * Resolves weekly-ad ingest candidates from catalog rows using source_name and
 * id conventions before display names (locator-backed Publix stores, etc.).
 */
export function buildWeeklyAdIngestStoreCandidates(
  stores: Pick<CatalogStore, "id" | "name" | "latitude" | "longitude" | "sourceName">[],
): WeeklyAdIngestStoreCandidate[] {
  return stores
    .map((store) => {
      const rollout = getProviderRolloutForCatalogStore(store);
      return {
        id: store.id,
        name: store.name,
        chain: rollout.chain,
        latitude: store.latitude,
        longitude: store.longitude,
      };
    })
    .filter(
      (
        store,
      ): store is WeeklyAdIngestStoreCandidate => isWeeklyAdChain(store.chain),
    );
}
