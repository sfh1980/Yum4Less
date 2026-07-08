import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  isFixtureOsmCatalogSource,
  isOsmStyleStoreId,
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
} from "@/lib/osm-food-retail-discovery";

export const USDA_SNAP_CONTEXT_SOURCE = "usda-snap-retailer-locator";

export type MapContextStoreCandidate = {
  id: string;
  name: string;
  kind: "grocery" | "big-box" | "specialty" | "dollar-market";
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  sourceName: string;
  sourceStoreId: string;
};

export type MapContextDiscoverySourceResult = {
  source: "openstreetmap-overpass" | "usda-snap-retailer-locator" | "fixture";
  stores: MapContextStoreCandidate[];
  message: string;
  cacheHit?: boolean;
};

export function isMapContextCatalogStore(store: CatalogStore): boolean {
  return (
    isOsmStyleStoreId(store.id) ||
    store.sourceName === OSM_MAP_CATALOG_SOURCE ||
    isFixtureOsmCatalogSource(store.sourceName) ||
    store.sourceName === OSM_MAP_FIXTURE_SOURCE ||
    store.id.startsWith("snap-") ||
    store.sourceName === USDA_SNAP_CONTEXT_SOURCE ||
    (store.id.startsWith("publix-") && store.sourceName === "publix-store-locator")
  );
}

export function isSnapMapContextEnabled(
  value = process.env.YUM4LESS_MAP_SNAP_CONTEXT,
): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
