import { getDistanceMiles } from "@/lib/geo-distance";
import {
  COORDINATE_SANITY_EXCEPTIONS,
  getCoordinateSanityPromotionRequirement,
  inferStoreChainFromCatalog,
  inferStoreChainFromName,
} from "@/lib/chain-rollout-policy";
import {
  checkCoordinateSanityBatch,
  type CoordinateSanityCheckOptions,
  type CoordinateSanityResult,
  type StoreForSanityCheck,
} from "@/lib/geo/coordinate-sanity-check";
import { loadCatalogStores } from "@/lib/market-catalog-repository";
import type { CatalogStore } from "@/lib/market-catalog-types";
import type { StoreChain } from "@/lib/provider-rollout";
import {
  findSnapRetailersNearLocation,
  type SnapRetailerLocationRow,
} from "@/lib/snap-retailer-locations";

const SNAP_COORDINATE_SANITY_MATCH_RADIUS_MILES = 1.5;

export type CoordinateSanityAuditStore = {
  storeId: string;
  storeName: string;
  sourceName?: string;
  storedCity: string | null;
  storedState: string | null;
  storedZip: string | null;
  storedCoords: { lat: number; lon: number };
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  addressSource: "snap-retailer-locations" | "missing";
  snapLocationId?: string;
  snapDistanceMiles?: number | null;
};

export type CoordinateSanityGateFailure = CoordinateSanityAuditStore & {
  result: CoordinateSanityResult;
};

export type CoordinateSanityGateOutcome = {
  required: boolean;
  passed: boolean;
  checkedStoreCount: number;
  failures: Array<CoordinateSanityGateFailure>;
  note: string;
};

export function toStoreForCoordinateSanityCheck(
  store: CoordinateSanityAuditStore,
): StoreForSanityCheck {
  return {
    id: store.storeId,
    address: store.address,
    city: store.storedCity,
    state: store.storedState,
    zip: store.storedZip,
    geocodeCity: store.city,
    geocodeState: store.state,
    geocodeZip: store.zip,
    lat: store.storedCoords.lat,
    lon: store.storedCoords.lon,
  };
}

export async function loadCoordinateSanityAuditStores(
  chain: StoreChain,
): Promise<CoordinateSanityAuditStore[]> {
  const stores = (await loadCatalogStores()).filter(
    (store) => inferStoreChainFromCatalog(store) === chain,
  );

  const auditStores: CoordinateSanityAuditStore[] = [];
  for (const store of stores) {
    const snapDiscovery = await findSnapRetailersNearLocation({
      latitude: store.latitude,
      longitude: store.longitude,
      radiusMiles: SNAP_COORDINATE_SANITY_MATCH_RADIUS_MILES,
    });
    const snapMatch = pickNearestSnapMatch(snapDiscovery.rows, chain, store);
    const storedCity = normalizeOptional(store.city);
    const storedState = normalizeOptional(store.state);

    auditStores.push({
      storeId: store.id,
      storeName: store.name,
      sourceName: store.sourceName,
      storedCity,
      storedState,
      storedZip: null,
      storedCoords: {
        lat: store.latitude,
        lon: store.longitude,
      },
      address: normalizeOptional(snapMatch?.addressLine1),
      city:
        isUnknownText(storedCity) || !storedCity
          ? normalizeOptional(snapMatch?.city) ?? storedCity
          : storedCity,
      state:
        isUnknownText(storedState) || !storedState
          ? normalizeOptional(snapMatch?.state) ?? storedState
          : storedState,
      zip: normalizeOptional(snapMatch?.zipCode),
      addressSource: snapMatch ? "snap-retailer-locations" : "missing",
      snapLocationId: snapMatch?.id,
      snapDistanceMiles: snapMatch
        ? getDistanceMiles(
            store.latitude,
            store.longitude,
            snapMatch.latitude,
            snapMatch.longitude,
          )
        : null,
    });
  }

  return auditStores;
}

export async function coordinateSanityGate(
  chain: StoreChain,
  options: CoordinateSanityCheckOptions = {},
): Promise<CoordinateSanityGateOutcome> {
  const requirement = getCoordinateSanityPromotionRequirement(chain);
  if (!requirement.required) {
    return {
      required: false,
      passed: true,
      checkedStoreCount: 0,
      failures: [],
      note: requirement.note,
    };
  }

  const auditStores = await loadCoordinateSanityAuditStores(chain);
  if (auditStores.length === 0) {
    return {
      required: true,
      passed: false,
      checkedStoreCount: 0,
      failures: [],
      note: `${requirement.note} No catalog stores were available to audit.`,
    };
  }

  const results = await checkCoordinateSanityBatch(
    auditStores.map(toStoreForCoordinateSanityCheck),
    options,
  );
  const failures = auditStores.flatMap((store) => {
    const result = results.get(store.storeId);
    if (!result || result.ok) {
      return [];
    }

    if (COORDINATE_SANITY_EXCEPTIONS[store.storeId]) {
      return [];
    }

    return [{ ...store, result }];
  });

  return {
    required: true,
    passed: failures.length === 0,
    checkedStoreCount: auditStores.length,
    failures,
    note: requirement.note,
  };
}

function pickNearestSnapMatch(
  rows: SnapRetailerLocationRow[],
  chain: StoreChain,
  store: CatalogStore,
): SnapRetailerLocationRow | undefined {
  return rows
    .filter((row) => inferStoreChainFromName(row.retailerName) === chain)
    .sort(
      (left, right) =>
        getDistanceMiles(
          store.latitude,
          store.longitude,
          left.latitude,
          left.longitude,
        ) -
        getDistanceMiles(
          store.latitude,
          store.longitude,
          right.latitude,
          right.longitude,
        ),
    )[0];
}

function isUnknownText(value: string | null): boolean {
  return value?.trim().toLowerCase() === "unknown";
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
