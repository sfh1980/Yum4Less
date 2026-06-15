/** User-facing copy for map pin location provenance (ingest-backed, not live on search). */

export type StoreMapLocationProvenance =
  | "bootstrap"
  | "api-verified"
  | "weekly-ad-ingest"
  | "osm-context"
  | "snap-context"
  | "indicative";

const STALE_VERIFICATION_HOURS = 48;

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

  if (sourceName === "usda-snap-retailer-locator") {
    return "USDA SNAP retailer directory";
  }

  if (sourceName === "publix-store-locator") {
    return "Publix store locator";
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

function isStaleVerification(lastVerifiedAt?: Date | string | null): boolean {
  if (!lastVerifiedAt) {
    return true;
  }

  const verifiedAt =
    typeof lastVerifiedAt === "string"
      ? new Date(lastVerifiedAt)
      : lastVerifiedAt;

  if (Number.isNaN(verifiedAt.getTime())) {
    return true;
  }

  const hoursAgo = (Date.now() - verifiedAt.getTime()) / (60 * 60 * 1000);
  return hoursAgo > STALE_VERIFICATION_HOURS;
}

export function resolveStoreMapLocationProvenance(input: {
  storeId: string;
  sourceName?: string | null;
  lastVerifiedAt?: Date | string | null;
}): StoreMapLocationProvenance {
  if (
    input.storeId.startsWith("osm-") ||
    input.sourceName === "openstreetmap-overpass"
  ) {
    return "osm-context";
  }

  if (
    input.storeId.startsWith("snap-") ||
    input.sourceName === "usda-snap-retailer-locator"
  ) {
    return "snap-context";
  }

  if (input.sourceName === "publix-store-locator") {
    return "indicative";
  }

  if (input.sourceName === "yum4less-internal-catalog") {
    return "bootstrap";
  }

  if (
    input.sourceName === "kroger-official-api" ||
    input.sourceName === "yum4less-market-catalog"
  ) {
    return "api-verified";
  }

  if (input.sourceName?.includes("weekly-ad-scrape")) {
    return "weekly-ad-ingest";
  }

  return "indicative";
}

export function buildStoreMapLocationBadge(input: {
  storeId: string;
  sourceName?: string | null;
  lastVerifiedAt?: Date | string | null;
}): string {
  const provenance = resolveStoreMapLocationProvenance(input);

  switch (provenance) {
    case "bootstrap":
      return "Bootstrap pin";
    case "api-verified":
      return isStaleVerification(input.lastVerifiedAt)
        ? "API pin · reverify"
        : "API-verified pin";
    case "weekly-ad-ingest":
      return "Weekly-ad ingest pin";
    case "osm-context":
      return "OSM context pin";
    case "snap-context":
      return "SNAP context pin";
    default:
      return "Indicative pin";
  }
}

export function buildStoreMapLocationNote(input: {
  storeId: string;
  sourceName?: string | null;
  lastVerifiedAt?: Date | string | null;
}): string {
  const sourceLabel = formatIngestSourceLabel(input.sourceName);
  const verifiedPart = formatLastVerifiedAge(input.lastVerifiedAt);
  const provenance = resolveStoreMapLocationProvenance(input);

  if (provenance === "osm-context") {
    return `OSM context pin from daily OpenStreetMap ingest${verifiedPart}. Not retailer-verified — confirm the address in person.`;
  }

  if (provenance === "snap-context") {
    return `USDA SNAP retailer directory context pin${verifiedPart}. Authorization and address may change — confirm before visiting. Not used for ranked meal estimates.`;
  }

  if (provenance === "bootstrap") {
    return "Bootstrap seed coordinates — not retailer-verified. Run daily live ingest (`npm run ingest:map-catalog` / scheduled wrapper) to replace with API-backed pins.";
  }

  if (input.sourceName === "kroger-official-api") {
    const staleSuffix = isStaleVerification(input.lastVerifiedAt)
      ? " Coordinates may be stale — confirm before visiting."
      : "";
    return `Location from ${sourceLabel}${verifiedPart}. Retailer API-backed ingest — confirm before visiting.${staleSuffix}`;
  }

  if (input.sourceName === "yum4less-market-catalog") {
    return `Location from ${sourceLabel}${verifiedPart} (not ZIP centroid). Confirm the store address before visiting.`;
  }

  if (provenance === "weekly-ad-ingest") {
    return `Coordinates from ${sourceLabel}${verifiedPart} — confirm the store address before visiting.`;
  }

  if (input.sourceName === "publix-store-locator") {
    return `Publix store locator context pin${verifiedPart}. Not used for ranked meal estimates — confirm before visiting.`;
  }

  return `Indicative map pin from ${sourceLabel}${verifiedPart}. Verify the store address before visiting.`;
}

export const MAP_CATALOG_LOCATION_FOOTNOTE =
  "Map pins reflect daily ingest (Kroger Location API, Aldi/market catalog, OpenStreetMap or USDA SNAP context, or bootstrap seed until live ingest runs). Badges show bootstrap vs API-verified vs context-only pins; hover a pin for source and last verified time — confirm locations before you shop.";
