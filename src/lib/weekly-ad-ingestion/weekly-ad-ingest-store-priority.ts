import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import { isOsmStyleStoreId } from "@/lib/osm-food-retail-discovery";
import { isWeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export type WeeklyAdIngestStoreRef = Pick<NearbyStoreSummary, "id" | "name" | "chain">;

/**
 * Prefer ingested catalog rows (e.g. aldi-mechanicsville, publix-1626) over OSM
 * map-context pins for weekly-ad fetch — offers are market/ZIP scoped, not per pin.
 */
export function scoreWeeklyAdIngestStorePriority(store: Pick<WeeklyAdIngestStoreRef, "id">): number {
  if (isOsmStyleStoreId(store.id)) {
    return 1;
  }

  if (/^(aldi|food-lion|publix|walmart|lidl|kroger)-/.test(store.id)) {
    return 5;
  }

  return 3;
}

export function pickPrimaryWeeklyAdIngestStoreForChain<T extends WeeklyAdIngestStoreRef>(
  stores: T[],
): T {
  if (stores.length === 0) {
    throw new Error("pickPrimaryWeeklyAdIngestStoreForChain requires at least one store");
  }

  return stores.reduce((best, store) => {
    const bestScore = scoreWeeklyAdIngestStorePriority(best);
    const storeScore = scoreWeeklyAdIngestStorePriority(store);
    if (storeScore > bestScore) {
      return store;
    }
    if (storeScore < bestScore) {
      return best;
    }
    return store.id.localeCompare(best.id) < 0 ? store : best;
  });
}

export function groupWeeklyAdIngestStoresByChain(
  stores: WeeklyAdIngestStoreRef[],
): Map<WeeklyAdChain, WeeklyAdIngestStoreRef[]> {
  const grouped = new Map<WeeklyAdChain, WeeklyAdIngestStoreRef[]>();

  for (const store of stores) {
    if (!isWeeklyAdChain(store.chain)) {
      continue;
    }

    const bucket = grouped.get(store.chain) ?? [];
    bucket.push(store);
    grouped.set(store.chain, bucket);
  }

  return grouped;
}
