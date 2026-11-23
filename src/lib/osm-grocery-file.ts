/**
 * Path the hand-run grocery loader reads.
 * The nightly ingest does not read this and does not schedule a load.
 * Unset, or blank, uses /osm/us-grocery.osm.pbf.
 */

export const OSM_GROCERY_FILE_ENV = "YUM4LESS_OSM_GROCERY_FILE";

/** Provenance written by the hand-run grocery loader. */
export const OSM_EXTRACT_SOURCE = "osm-extract";

export const OSM_GROCERY_FILE_DEFAULT = "/osm/us-grocery.osm.pbf";

export function readOsmGroceryFile(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env[OSM_GROCERY_FILE_ENV]?.trim();
  if (!raw) {
    return OSM_GROCERY_FILE_DEFAULT;
  }

  return raw;
}
