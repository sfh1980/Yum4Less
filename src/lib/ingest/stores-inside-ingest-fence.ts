import type { IngestFence } from "@/lib/market-ingest-fence";
import { storePassesIngestFence } from "@/lib/market-ingest-fence";
import {
  filterCatalogStoresNearLocation,
  type CatalogStoreCoordinate,
} from "@/lib/store-catalog-sync";

/**
 * Catalog rows inside one ZIP's ingest fence.
 * The weekly-ad night and the morning note both use this. Each caller still
 * chooses its own store list and what it keeps from the result.
 */
export function storesInsideIngestFence<T extends CatalogStoreCoordinate>(input: {
  stores: readonly T[];
  location: { latitude: number; longitude: number };
  fence: Pick<IngestFence, "ingestMiles" | "geometry">;
}): T[] {
  return filterCatalogStoresNearLocation(
    [...input.stores],
    input.location,
    input.fence.ingestMiles,
  ).filter((store) =>
    storePassesIngestFence({
      latitude: store.latitude,
      longitude: store.longitude,
      center: input.location,
      fence: input.fence,
    }),
  );
}
