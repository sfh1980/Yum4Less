import { listIngestMarkets } from "@/lib/active-markets";
import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import { isValidZipCode } from "@/lib/api-request";
import type { GeoJsonGeometry } from "@/lib/geo/point-in-polygon";
import { resolveZctaGeometry } from "@/lib/geo/zcta-boundary";
import { lookupZctaFromPoint } from "@/lib/geo/zcta-from-point";
import { resolveZipLocation } from "@/lib/geocoding";
import {
  buildMarketReachSummary,
  containingZipCode,
  MARKET_REACH_RADIUS_MILES,
  storesWithinReach,
  type MarketReachStore,
} from "@/lib/owner/market-reach";
import type { OwnerMarketCoverageShade } from "@/lib/owner/owner-market-coverage-map-model";
import { listOwnerMarketCoverageShades } from "@/lib/owner/owner-market-coverage-shades";
import { loadBuiltStoreCoverageRows } from "@/lib/owner/store-coverage-repository";

const MAX_ZCTA_LOOKUPS = 30;

export type OwnerMarketReach = {
  zipCode: string;
  sentence: string;
  circle: { latitude: number; longitude: number; radiusMiles: number } | null;
  shades: OwnerMarketCoverageShade[];
  labelZipCodes: string[];
  offZips: Array<{
    zipCode: string;
    storeCount: number;
    reason: string;
    stores: Array<{
      storeId: string;
      name: string;
      chainLabel: string;
      city: string;
      state: string;
      sourceStoreId: string | null;
      addressLine: string | null;
      postalCode: string | null;
    }>;
  }>;
  notice?: string;
};

export async function buildOwnerMarketReach(
  zipCode: string,
): Promise<{ ok: true; reach: OwnerMarketReach } | { ok: false; error: string }> {
  if (!isValidZipCode(zipCode)) {
    return { ok: false, error: "Enter a 5-digit ZIP code." };
  }
  const markets = await listIngestMarkets();
  const selected = markets.find((market) => market.zipCode === zipCode);
  if (!selected || (selected.status !== "active" && selected.status !== "paused")) {
    return { ok: false, error: "That ZIP is not an active or paused market." };
  }

  const center = await resolveReachCenter(selected);
  if (!center) {
    return { ok: false, error: "That ZIP has no map point yet." };
  }

  const knownShades = await listOwnerMarketCoverageShades(markets);
  const selectedShade = knownShades.find((shade) => shade.zipCode === zipCode);
  const loaded = await loadBuiltStoreCoverageRows();
  const ranked = storesWithinReach({
    center,
    stores: loaded.rows.flatMap((row) => {
      if (!loaded.rankedChainIds.has(row.chainId)) {
        return [];
      }
      if (row.latitude === null || row.longitude === null) {
        return [];
      }
      const store: MarketReachStore = {
        storeId: row.storeId,
        name: row.name,
        chainLabel: row.chainLabel,
        city: row.city,
        state: row.state,
        sourceStoreId: row.sourceStoreId,
        addressLine: row.addressLine,
        postalCode: row.postalCode,
        latitude: row.latitude,
        longitude: row.longitude,
        usable: row.usableInApp,
      };
      return [store];
    }),
  });

  const streets = await loadLinkedStreetAddresses(ranked.map((store) => store.storeId));
  const rankedWithStreets = ranked.map((store) => {
    const linked = streets.get(store.storeId);
    if (!linked) {
      return store;
    }
    return {
      ...store,
      addressLine: store.addressLine ?? linked.addressLine,
      postalCode: store.postalCode ?? linked.postalCode,
    };
  });

  const areas = knownShades.map((shade) => ({
    zipCode: shade.zipCode,
    geometry: shade.geometry,
  }));
  const assigned = rankedWithStreets.map((store) => ({
    ...store,
    zipCode: containingZipCode(store, areas, zipCode),
  }));
  const unresolved = assigned.filter((store) => store.zipCode === null).slice(0, MAX_ZCTA_LOOKUPS);
  const lookedUp = new Map<string, string>();
  await Promise.all(
    unresolved.map(async (store) => {
      const found = await lookupZctaFromPoint({
        latitude: store.latitude,
        longitude: store.longitude,
      });
      if (found) {
        lookedUp.set(storeKey(store), found);
      }
    }),
  );
  const withZips = assigned.map((store) => ({
    ...store,
    zipCode: store.zipCode ?? lookedUp.get(storeKey(store)) ?? null,
  }));

  const activeZipCodes = new Set(
    markets
      .filter((market) => market.status === "active" || market.status === "paused")
      .map((market) => market.zipCode),
  );
  const summary = buildMarketReachSummary({ stores: withZips, activeZipCodes });
  const extraGeometries = new Map<string, GeoJsonGeometry>();
  for (const group of summary.offZips) {
    if (group.zipCode === "unknown" || knownShades.some((shade) => shade.zipCode === group.zipCode)) {
      continue;
    }
    const zcta = await resolveZctaGeometry({ zipCode: group.zipCode });
    if (zcta.ok) {
      extraGeometries.set(group.zipCode, zcta.geometry);
    }
  }

  const shades: OwnerMarketCoverageShade[] = selectedShade ? [selectedShade] : [];
  const labelZipCodes: string[] = [];
  for (const [code, geometry] of extraGeometries) {
    shades.push({ zipCode: code, status: "off", geometry });
    labelZipCodes.push(code);
  }

  return {
    ok: true,
    reach: {
      zipCode,
      sentence: summary.sentence,
      circle: { ...center, radiusMiles: MARKET_REACH_RADIUS_MILES },
      shades,
      labelZipCodes,
      offZips: summary.offZips.map((group) => ({
        zipCode: group.zipCode === "unknown" ? "Nearby" : group.zipCode,
        storeCount: group.storeCount,
        reason: group.reason,
        stores: group.stores,
      })),
      notice: selectedShade
        ? undefined
        : "The ZIP outline did not load. The circle is still the 8-mile area.",
    },
  };
}

async function resolveReachCenter(market: {
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  if (market.latitude !== null && market.longitude !== null) {
    return { latitude: market.latitude, longitude: market.longitude };
  }
  const geocoded = await resolveZipLocation(market.zipCode).catch(() => null);
  if (geocoded && geocoded.ok) {
    return {
      latitude: geocoded.location.latitude,
      longitude: geocoded.location.longitude,
    };
  }
  return null;
}

function storeKey(store: { storeId: string }): string {
  return store.storeId;
}

async function loadLinkedStreetAddresses(
  storeIds: readonly string[],
): Promise<Map<string, { addressLine: string | null; postalCode: string | null }>> {
  const found = new Map<string, { addressLine: string | null; postalCode: string | null }>();
  if (storeIds.length === 0) {
    return found;
  }
  try {
    const result = await getDbPool().query<{
      store_id: string;
      address_line1: string | null;
      zip_code: string | null;
    }>(
      `
        select distinct on (a.store_id)
          a.store_id,
          snap.address_line1,
          snap.zip_code
        from store_identity_aliases a
        join snap_retailer_locations snap on snap.id = a.snap_retailer_id
        where a.store_id = any($1::text[])
          and a.link_status in ('confirmed', 'provisional')
          and a.snap_retailer_id is not null
        order by a.store_id, case when a.link_status = 'confirmed' then 0 else 1 end
      `,
      [storeIds],
    );
    for (const row of result.rows) {
      const addressLine = row.address_line1?.trim() || null;
      const postalCode = row.zip_code?.trim() || null;
      if (addressLine || postalCode) {
        found.set(row.store_id, { addressLine, postalCode });
      }
    }
  } catch (error) {
    logServerError("owner.market-reach.street", error);
    return found;
  }
  return found;
}
