import type { NearbyStoreSummary } from "@/lib/recommendation-types";
import {
  getCanonicalShopperChainDisplayName,
  inferShopperBannerDisplayName,
  isPublixCatalogSourceName,
} from "@/lib/chain-rollout-policy";

export const APPROXIMATE_LOCATION_LABEL = "Approximate location";

export type StoreDisplayNameInput = Pick<
  NearbyStoreSummary,
  "name" | "chain" | "sourceName"
>;

export function isUnknownLocationValue(value?: string): boolean {
  return value?.trim().toLowerCase() === "unknown";
}

export function isMissingStoreLocalityPart(value?: string): boolean {
  return !value?.trim() || isUnknownLocationValue(value);
}

export function formatStoreCityState(
  store: { city?: string; state?: string },
): string | undefined {
  const city = store.city?.trim();
  const state = store.state?.trim();

  if (isUnknownLocationValue(city) || isUnknownLocationValue(state)) {
    return APPROXIMATE_LOCATION_LABEL;
  }

  if (city && state) {
    return `${city}, ${state}`;
  }

  if (city) {
    return city;
  }

  if (state) {
    return state;
  }

  return undefined;
}

/** Shopper-facing store headline (DB/catalog raw names unchanged at rest). */
export function resolveStoreDisplayHeadline(store: StoreDisplayNameInput): string {
  if (isPublixCatalogSourceName(store.sourceName)) {
    return getCanonicalShopperChainDisplayName("publix") ?? "Publix";
  }

  const bannerFromName = inferShopperBannerDisplayName(store.name);
  if (bannerFromName) {
    return bannerFromName;
  }

  if (store.chain && store.chain !== "unknown") {
    const canonical = getCanonicalShopperChainDisplayName(store.chain);
    if (canonical) {
      return canonical;
    }
  }

  return store.name;
}

/** Optional locator shopping-center label for Publix rows (not the headline). */
export function resolveStoreLocatorSubtitle(
  store: StoreDisplayNameInput,
): string | undefined {
  if (!isPublixCatalogSourceName(store.sourceName)) {
    return undefined;
  }

  const headline = resolveStoreDisplayHeadline(store);
  const rawName = store.name.trim();
  if (!rawName || rawName.toLowerCase() === headline.toLowerCase()) {
    return undefined;
  }

  return rawName;
}

export function formatStoreHeadlineWithOptionalSubtitle(
  store: StoreDisplayNameInput,
): string {
  const headline = resolveStoreDisplayHeadline(store);
  const subtitle = resolveStoreLocatorSubtitle(store);
  return subtitle ? `${headline} (${subtitle})` : headline;
}

/** Primary line: display name plus city/state when known. */
export function formatStoreNameWithLocation(
  store: Pick<NearbyStoreSummary, "name"> & { city?: string; state?: string },
): string {
  const location = formatStoreCityState(store);
  return location ? `${store.name} — ${location}` : store.name;
}

/** Nearby-store distance copy — haversine miles, labeled honestly. */
export function formatStraightLineDistanceMiles(distanceMiles: number): string {
  return `${distanceMiles} mi straight-line`;
}

/** Settings dropdown / multi-select option text. */
export function formatSettingsStoreOptionLabel(
  store: Pick<NearbyStoreSummary, "name" | "distanceMiles"> & {
    city?: string;
    state?: string;
  },
): string {
  return `${formatStoreNameWithLocation(store)} (${formatStraightLineDistanceMiles(store.distanceMiles)})`;
}
