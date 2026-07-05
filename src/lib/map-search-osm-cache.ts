import type { OsmDiscoveredFoodRetailStore } from "@/lib/osm-food-retail-discovery";
import { discoverFoodRetailStoresNearLocation } from "@/lib/osm-food-retail-discovery";

const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type OsmCacheEntry = {
  stores: OsmDiscoveredFoodRetailStore[];
  message: string;
  source: "openstreetmap-overpass" | "fixture";
  expiresAt: number;
};

const searchOsmCache = new Map<string, OsmCacheEntry>();

export function resolveMapSearchOsmCacheTtlMs(
  value = process.env.YUM4LESS_MAP_SEARCH_OSM_CACHE_TTL_MS,
): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_CACHE_TTL_MS;
}

export function shouldUseMapSearchOsmFixture(): boolean {
  return (
    process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  );
}

function buildSearchOsmCacheKey(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
}): string {
  return `${input.latitude.toFixed(3)},${input.longitude.toFixed(3)},${input.radiusMiles}`;
}

export function clearMapSearchOsmCacheForTests(): void {
  searchOsmCache.clear();
}

export async function discoverOsmStoresForMapSearch(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
  forceRefresh?: boolean;
}): Promise<{
  stores: OsmDiscoveredFoodRetailStore[];
  message: string;
  source: "openstreetmap-overpass" | "fixture";
  cacheHit: boolean;
}> {
  const cacheKey = buildSearchOsmCacheKey(input);
  const now = Date.now();
  const cached = searchOsmCache.get(cacheKey);

  if (!input.forceRefresh && cached && cached.expiresAt > now) {
    return {
      stores: cached.stores,
      message: cached.message,
      source: cached.source,
      cacheHit: true,
    };
  }

  const discovery = await discoverFoodRetailStoresNearLocation({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMiles: input.radiusMiles,
    zipCode: input.zipCode,
    useFixture: shouldUseMapSearchOsmFixture(),
  });

  searchOsmCache.set(cacheKey, {
    stores: discovery.stores,
    message: discovery.message,
    source: discovery.source,
    expiresAt: now + resolveMapSearchOsmCacheTtlMs(),
  });

  return {
    stores: discovery.stores,
    message: discovery.message,
    source: discovery.source,
    cacheHit: false,
  };
}
