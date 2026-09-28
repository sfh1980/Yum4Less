import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import { pointInZcta } from "@/lib/geo/zcta-boundary";
import { getDistanceMiles } from "@/lib/geo-distance";
import { DENSITY_CLASSIFY_RADIUS_MILES } from "@/lib/market-density";

export const MARKET_REACH_RADIUS_MILES = DENSITY_CLASSIFY_RADIUS_MILES;
export const TURN_ZIP_ON_REASON = "Turn this ZIP on.";
export const ZIP_UNKNOWN_REASON = "We could not tell which ZIP this pin sits in.";

export type MarketReachStore = {
  storeId: string;
  name: string;
  chainLabel: string;
  city: string;
  state: string;
  sourceStoreId: string | null;
  addressLine: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  usable: boolean;
};

export type MarketReachArea = {
  zipCode: string;
  geometry: GeoJsonGeometry;
};

export type MarketReachOffStore = {
  storeId: string;
  name: string;
  chainLabel: string;
  city: string;
  state: string;
  sourceStoreId: string | null;
  addressLine: string | null;
  postalCode: string | null;
};

export type MarketReachOffZip = {
  zipCode: string;
  storeCount: number;
  reason: string;
  stores: MarketReachOffStore[];
};

export type MarketReachSummary = {
  pricedCount: number;
  nearbyCount: number;
  offZipStoreCount: number;
  sentence: string;
  offZips: MarketReachOffZip[];
};

export function containingZipCode(
  store: Pick<MarketReachStore, "latitude" | "longitude">,
  areas: readonly MarketReachArea[],
  preferredZip?: string,
): string | null {
  const ordered = preferredZip
    ? [
        ...areas.filter((area) => area.zipCode === preferredZip),
        ...areas.filter((area) => area.zipCode !== preferredZip),
      ]
    : areas;
  for (const area of ordered) {
    if (pointInZcta(area.geometry, store.latitude, store.longitude)) {
      return area.zipCode;
    }
  }
  return null;
}

export function storesWithinReach(input: {
  center: { latitude: number; longitude: number };
  stores: readonly MarketReachStore[];
  radiusMiles?: number;
}): MarketReachStore[] {
  const radiusMiles = input.radiusMiles ?? MARKET_REACH_RADIUS_MILES;
  return input.stores.filter(
    (store) =>
      getDistanceMiles(
        input.center.latitude,
        input.center.longitude,
        store.latitude,
        store.longitude,
      ) <= radiusMiles,
  );
}

export function buildMarketReachSummary(input: {
  stores: readonly (MarketReachStore & { zipCode: string | null })[];
  activeZipCodes: ReadonlySet<string>;
}): MarketReachSummary {
  const nearbyCount = input.stores.length;
  const pricedCount = input.stores.filter((store) => store.usable).length;
  const offStores = input.stores.filter(
    (store) => !store.usable && (store.zipCode === null || !input.activeZipCodes.has(store.zipCode)),
  );
  const onButUnpriced = nearbyCount - pricedCount - offStores.length;
  const groups = new Map<string, MarketReachOffStore[]>();
  for (const store of offStores) {
    const zipCode = store.zipCode ?? "unknown";
    const list = groups.get(zipCode) ?? [];
    list.push({
      storeId: store.storeId,
      name: store.name,
      chainLabel: store.chainLabel,
      city: store.city,
      state: store.state,
      sourceStoreId: store.sourceStoreId,
      addressLine: store.addressLine,
      postalCode: store.postalCode,
    });
    groups.set(zipCode, list);
  }
  const offZips = [...groups.entries()]
    .map(([zipCode, stores]) => ({
      zipCode,
      storeCount: stores.length,
      reason: zipCode === "unknown" ? ZIP_UNKNOWN_REASON : TURN_ZIP_ON_REASON,
      stores: stores.sort((a, b) => a.chainLabel.localeCompare(b.chainLabel) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.storeCount - a.storeCount || a.zipCode.localeCompare(b.zipCode));

  return {
    pricedCount,
    nearbyCount,
    offZipStoreCount: offStores.length,
    sentence: reachSentence({
      pricedCount,
      nearbyCount,
      offZipStoreCount: offStores.length,
      onButUnpriced,
    }),
    offZips,
  };
}

export function reachSentence(input: {
  pricedCount: number;
  nearbyCount: number;
  offZipStoreCount: number;
  onButUnpriced: number;
}): string {
  if (input.nearbyCount === 0) {
    return "No ranked stores are saved within 8 miles.";
  }
  const priced = `${input.pricedCount} of ${input.nearbyCount} nearby stores can be priced.`;
  if (input.offZipStoreCount > 0) {
    const off = `${input.offZipStoreCount} sit in ZIPs that are still off.`;
    if (input.onButUnpriced > 0) {
      return `${priced} ${off} ${input.onButUnpriced} more are in a ZIP you turned on, but have no price yet.`;
    }
    return `${priced} ${off}`;
  }
  if (input.onButUnpriced > 0) {
    return `${priced} The rest are in ZIPs you turned on, but have no price yet.`;
  }
  return input.nearbyCount === 1
    ? "The nearby store can be priced."
    : `All ${input.nearbyCount} nearby stores can be priced.`;
}
