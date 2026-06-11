/** User-facing copy for map pin location provenance (ingest-backed, not live on search). */

export function formatIngestSourceLabel(sourceName?: string | null): string {
  if (!sourceName || sourceName === "yum4less-internal-catalog") {
    return "bootstrap seed catalog";
  }

  if (sourceName === "kroger-official-api") {
    return "Kroger Location API";
  }

  if (sourceName === "openstreetmap-overpass") {
    return "OpenStreetMap";
  }

  if (sourceName === "yum4less-market-catalog") {
    return "market geocode catalog";
  }

  if (sourceName.includes("weekly-ad-scrape")) {
    return "weekly-ad ingest catalog";
  }

  return "daily ingest catalog";
}

export function formatLastVerifiedAge(
  lastVerifiedAt?: Date | string | null,
): string {
  if (!lastVerifiedAt) {
    return "";
  }

  const verifiedAt =
    typeof lastVerifiedAt === "string"
      ? new Date(lastVerifiedAt)
      : lastVerifiedAt;

  if (Number.isNaN(verifiedAt.getTime())) {
    return "";
  }

  const hoursAgo = Math.floor(
    (Date.now() - verifiedAt.getTime()) / (60 * 60 * 1000),
  );

  if (hoursAgo < 1) {
    return " · last verified less than 1 hour ago";
  }

  if (hoursAgo < 24) {
    return ` · last verified ~${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;
  }

  const daysAgo = Math.floor(hoursAgo / 24);
  return ` · last verified ~${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
}

export function buildStoreMapLocationNote(input: {
  storeId: string;
  sourceName?: string | null;
  lastVerifiedAt?: Date | string | null;
}): string {
  const sourceLabel = formatIngestSourceLabel(input.sourceName);
  const verifiedPart = formatLastVerifiedAge(input.lastVerifiedAt);

  if (
    input.storeId.startsWith("osm-") ||
    input.sourceName === "openstreetmap-overpass"
  ) {
    return `Location ingested daily from OpenStreetMap${verifiedPart}. Verify the address in person.`;
  }

  if (input.sourceName === "yum4less-internal-catalog") {
    return "Bootstrap seed coordinates — run daily live ingest to replace with retailer-verified pins.";
  }

  if (input.sourceName === "kroger-official-api") {
    return `Location ingested daily from ${sourceLabel}${verifiedPart}. Confirm before visiting.`;
  }

  if (input.sourceName === "yum4less-market-catalog") {
    return `Location ingested daily from ${sourceLabel}${verifiedPart}. Confirm the store address before visiting.`;
  }

  if (input.sourceName?.includes("weekly-ad-scrape")) {
    return `Coordinates from ${sourceLabel}${verifiedPart} — confirm the store address before visiting.`;
  }

  return `Indicative map pin from ${sourceLabel}${verifiedPart}. Verify the store address before visiting.`;
}

export const MAP_CATALOG_LOCATION_FOOTNOTE =
  "Map pins reflect the last daily ingest (Kroger Location API, OpenStreetMap, or bootstrap seed until live ingest runs). Hover a pin for source and last verified time; confirm locations before you shop.";
