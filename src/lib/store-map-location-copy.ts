/** User-facing copy for map pin location provenance (ingest-backed, not live on search). */

import {
  isFixtureOsmCatalogSource,
  isFixtureOsmStoreId,
  isLiveOsmStoreId,
  isNonLiveOsmCatalogIdentity,
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
} from "@/lib/osm-food-retail-discovery";

export type StoreMapLocationProvenance =
  | "bootstrap"
  | "api-verified"
  | "weekly-ad-ingest"
  | "osm-context"
  | "map-fixture"
  | "snap-context"
  | "indicative";

const STALE_VERIFICATION_HOURS = 48;

export function formatIngestSourceLabel(sourceName?: string | null): string {
  if (!sourceName || sourceName === "yum4less-internal-catalog") {
    return "seed catalog";
  }

  if (sourceName === "kroger-official-api") {
    return "retailer store directory";
  }

  if (sourceName === OSM_MAP_CATALOG_SOURCE) {
    return "OpenStreetMap";
  }

  if (isFixtureOsmCatalogSource(sourceName) || sourceName === OSM_MAP_FIXTURE_SOURCE) {
    return "map fixture rehearsal";
  }

  if (sourceName === "usda-snap-retailer-locator") {
    return "retailer directory";
  }

  if (sourceName === "publix-store-locator") {
    return "store locator";
  }

  if (sourceName === "yum4less-market-catalog") {
    return "market geocode catalog";
  }

  if (sourceName.includes("weekly-ad-scrape")) {
    return "saved store catalog";
  }

  return "saved store data";
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
    isFixtureOsmStoreId(input.storeId) ||
    isFixtureOsmCatalogSource(input.sourceName) ||
    isNonLiveOsmCatalogIdentity({
      id: input.storeId,
      sourceName: input.sourceName,
    })
  ) {
    return "map-fixture";
  }

  if (
    isLiveOsmStoreId(input.storeId) ||
    input.sourceName === OSM_MAP_CATALOG_SOURCE
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
      return "Seed catalog pin";
    case "api-verified":
      return isStaleVerification(input.lastVerifiedAt)
        ? "Verified pin · reverify"
        : "Verified store pin";
    case "weekly-ad-ingest":
      return "Saved store pin";
    case "osm-context":
      return "Map context pin";
    case "map-fixture":
      return "Rehearsal map pin";
    case "snap-context":
      return "Map context pin";
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
    return `Map context pin from OpenStreetMap${verifiedPart}. Confirm the address before visiting.`;
  }

  if (provenance === "map-fixture") {
    return `Rehearsal map fixture pin${verifiedPart} — not a live OpenStreetMap storefront. Confirm before visiting.`;
  }

  if (provenance === "snap-context") {
    return `Retailer directory context pin${verifiedPart}. Confirm before visiting — not used for dinner estimates.`;
  }

  if (provenance === "bootstrap") {
    return "Seed catalog coordinates — confirm the store address before visiting.";
  }

  if (input.sourceName === "kroger-official-api") {
    const staleSuffix = isStaleVerification(input.lastVerifiedAt)
      ? " Coordinates may be stale — confirm before visiting."
      : "";
    return `Location from ${sourceLabel}${verifiedPart}. Confirm before visiting.${staleSuffix}`;
  }

  if (input.sourceName === "yum4less-market-catalog") {
    return `Location from ${sourceLabel}${verifiedPart} (not ZIP centroid). Confirm the store address before visiting.`;
  }

  if (provenance === "weekly-ad-ingest") {
    return `Coordinates from ${sourceLabel}${verifiedPart} — confirm the store address before visiting.`;
  }

  if (input.sourceName === "publix-store-locator") {
    return `Store locator context pin${verifiedPart}. Not used for dinner estimates — confirm before visiting.`;
  }

  return `Indicative map pin from ${sourceLabel}${verifiedPart}. Verify the store address before visiting.`;
}

export const MAP_CATALOG_LOCATION_FOOTNOTE =
  "Map pins come from saved store data or map sources — confirm locations before you shop.";
