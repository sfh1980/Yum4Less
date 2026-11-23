import { getDbPool } from "@/lib/db";
import { boundingBoxForRadiusMiles, getDistanceMiles } from "@/lib/geo-distance";
import type { CatalogStore, StoreKind } from "@/lib/market-catalog-types";
import { OSM_EXTRACT_SOURCE } from "@/lib/osm-grocery-file";
import { logServerError } from "@/lib/server-log";

type OsmGroceryPlaceRow = {
  id: string;
  name: string;
  kind: StoreKind;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  source_name: string;
  file_timestamp: Date | null;
};

/**
 * Open grocery-file pins inside the search radius.
 * A missing table, or a database that is down, returns no pins so store
 * search still uses the saved catalog. Overpass is not called.
 */
export async function loadOsmGroceryPlacesNear(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
}): Promise<CatalogStore[]> {
  try {
    const box = boundingBoxForRadiusMiles(
      input.latitude,
      input.longitude,
      input.radiusMiles,
    );
    const result = await getDbPool().query<OsmGroceryPlaceRow>(
      `
        select id, name, kind, city, state, latitude, longitude, source_name, file_timestamp
        from osm_grocery_places
        where closed_at is null
          and source_name = $5
          and latitude between $1 and $2
          and longitude between $3 and $4
      `,
      [
        box.minLatitude,
        box.maxLatitude,
        box.minLongitude,
        box.maxLongitude,
        OSM_EXTRACT_SOURCE,
      ],
    );
    return result.rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        city: row.city,
        state: row.state,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        sourceName: row.source_name,
        sourceStoreId: row.id,
      }))
      .filter(
        (place) =>
          getDistanceMiles(
            input.latitude,
            input.longitude,
            place.latitude,
            place.longitude,
          ) <= input.radiusMiles,
      );
  } catch (error) {
    logServerError("osm-grocery-places.search", error);
    return [];
  }
}

export function mergeOsmGroceryPlaces(
  stores: CatalogStore[],
  places: CatalogStore[],
): CatalogStore[] {
  if (places.length === 0) {
    return stores;
  }
  const seen = new Set(stores.map((store) => store.id));
  const merged = [...stores];
  for (const place of places) {
    if (seen.has(place.id)) {
      continue;
    }
    merged.push(place);
    seen.add(place.id);
  }
  return merged;
}
