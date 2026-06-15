import {
  type MapContextDiscoverySourceResult,
  type MapContextStoreCandidate,
  isSnapMapContextEnabled,
} from "@/lib/map-context-types";
import { discoverOsmStoresForMapSearch } from "@/lib/map-search-osm-cache";
import {
  findSnapRetailersNearLocation,
  snapRetailerRowToMapContextCandidate,
} from "@/lib/snap-retailer-locations";
import { buildOsmCatalogStore } from "@/lib/store-catalog-sync";
import type { OsmDiscoveredFoodRetailStore } from "@/lib/osm-food-retail-discovery";

export type MapContextDiscoveryResult = {
  stores: MapContextStoreCandidate[];
  sources: MapContextDiscoverySourceResult[];
};

function osmStoresToCandidates(
  stores: OsmDiscoveredFoodRetailStore[],
): MapContextStoreCandidate[] {
  return stores.map((store) => {
    const catalog = buildOsmCatalogStore(store);
    return {
      id: catalog.id,
      name: catalog.name,
      kind: catalog.kind,
      city: catalog.city,
      state: catalog.state,
      latitude: catalog.latitude,
      longitude: catalog.longitude,
      sourceName: catalog.sourceName,
      sourceStoreId: catalog.sourceStoreId,
    };
  });
}

export async function discoverMapContextStores(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
  includeOsm?: boolean;
  includeSnap?: boolean;
}): Promise<MapContextDiscoveryResult> {
  const sources: MapContextDiscoverySourceResult[] = [];
  const stores: MapContextStoreCandidate[] = [];

  if (input.includeOsm !== false) {
    const osmDiscovery = await discoverOsmStoresForMapSearch({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMiles: input.radiusMiles,
      zipCode: input.zipCode,
    });

    const osmStores = osmStoresToCandidates(osmDiscovery.stores);
    stores.push(...osmStores);
    sources.push({
      source: osmDiscovery.source,
      stores: osmStores,
      message: osmDiscovery.message,
      cacheHit: osmDiscovery.cacheHit,
    });
  }

  if (input.includeSnap !== false && isSnapMapContextEnabled()) {
    const snapDiscovery = await findSnapRetailersNearLocation({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMiles: input.radiusMiles,
      zipCode: input.zipCode,
    });

    const snapStores = snapDiscovery.rows.map(snapRetailerRowToMapContextCandidate);
    stores.push(...snapStores);
    sources.push({
      source: "usda-snap-retailer-locator",
      stores: snapStores,
      message: snapDiscovery.snapshotDate
        ? `${snapDiscovery.message} Snapshot ${snapDiscovery.snapshotDate}.`
        : snapDiscovery.message,
    });
  }

  return { stores, sources };
}

export function mapContextCandidateToCatalogStore(
  candidate: MapContextStoreCandidate,
): import("@/lib/store-catalog-sync").CatalogStoreRecord {
  return {
    id: candidate.id,
    name: candidate.name,
    kind: candidate.kind,
    city: candidate.city,
    state: candidate.state,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    sourceName: candidate.sourceName,
    sourceStoreId: candidate.sourceStoreId,
  };
}
