import type {
  MarketSummary,
  NearbyStoreSummary,
} from "@/lib/recommendation-service";
import type { StoreChain } from "@/lib/provider-rollout";
import type { StoreMapLocationProvenance } from "@/lib/store-map-location-copy";

export type MapAnchorSource = "zip" | "browser" | "seed";

export type MapStoreMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  chain: StoreChain;
  chainLabel: string;
  recommendationEnabled: boolean;
  rolloutStatus: NearbyStoreSummary["rolloutStatus"];
  rolloutNote: string;
  locationProvenance: StoreMapLocationProvenance;
  locationBadge: string;
  locationNote: string;
  /** Server-provided identity members for expand-aware highlight (Slice 5b). */
  equivalentStoreIds?: string[];
};

/** Full multi-store discovery map: search anchor, radius circle, and all nearby pins. */
export type DiscoveryMapModel = {
  kind: "discovery";
  anchor: {
    latitude: number;
    longitude: number;
    label: string;
    source: MapAnchorSource;
  };
  radiusMiles: number;
  stores: MapStoreMarker[];
  /** True when any visible pin came from OSM map-catalog ingest. */
  usesOsmCatalogData: boolean;
};

/** Single-store overlay: one store pin only — no search radius or anchor chrome. */
export type SingleStoreMapModel = {
  kind: "single-store";
  store: MapStoreMarker;
  usesOsmCatalogData: boolean;
};

export type StoresMapModel = DiscoveryMapModel | SingleStoreMapModel;

/** @deprecated Use `DiscoveryMapModel`. */
export type NearbyStoresMapModel = DiscoveryMapModel;

function toMapStoreMarker(store: NearbyStoreSummary): MapStoreMarker {
  return {
    id: store.id,
    name: store.name,
    latitude: store.latitude,
    longitude: store.longitude,
    distanceMiles: store.distanceMiles,
    chain: store.chain,
    chainLabel: store.chainLabel,
    recommendationEnabled: store.recommendationEnabled,
    rolloutStatus: store.rolloutStatus,
    rolloutNote: store.rolloutNote,
    locationProvenance: store.locationProvenance,
    locationBadge: store.locationBadge,
    locationNote: store.locationNote,
    equivalentStoreIds: store.equivalentStoreIds,
  };
}

/** Discovery map context (`StoreMapOverlay`, `MarketDiscoveryPanel`). */
export function buildDiscoveryMapModel(
  market: Pick<
    MarketSummary,
    | "nearbyStores"
    | "searchLatitude"
    | "searchLongitude"
    | "locationLabel"
    | "lookupSource"
    | "radiusMiles"
    | "usesEphemeralOsmDiscovery"
  >,
): DiscoveryMapModel {
  const source = toMapAnchorSource(market.lookupSource);

  return {
    kind: "discovery",
    anchor: {
      latitude: market.searchLatitude,
      longitude: market.searchLongitude,
      label: market.locationLabel,
      source,
    },
    radiusMiles: market.radiusMiles,
    stores: market.nearbyStores.map(toMapStoreMarker),
    usesOsmCatalogData:
      market.usesEphemeralOsmDiscovery === true ||
      market.nearbyStores.some((store) => store.id.startsWith("osm-")),
  };
}

/** Single-store overlay context (`SingleStoreMapOverlay`). */
export function buildSingleStoreMapModel(
  store: NearbyStoreSummary,
): SingleStoreMapModel {
  return {
    kind: "single-store",
    store: toMapStoreMarker(store),
    usesOsmCatalogData: store.id.startsWith("osm-"),
  };
}

/** @deprecated Use `buildDiscoveryMapModel`. */
export const buildNearbyStoresMapModel = buildDiscoveryMapModel;

function toMapAnchorSource(
  lookupSource: MarketSummary["lookupSource"],
): MapAnchorSource {
  if (lookupSource === "browser") {
    return "browser";
  }

  if (lookupSource === "geocodio") {
    return "zip";
  }

  return "seed";
}

export type MapBoundsResult =
  | {
      kind: "center";
      center: [number, number];
      zoom: number;
    }
  | {
      kind: "bounds";
      southWest: [number, number];
      northEast: [number, number];
    };

export function getMapBounds(model: StoresMapModel): MapBoundsResult {
  if (model.kind === "single-store") {
    return {
      kind: "center",
      center: [model.store.latitude, model.store.longitude],
      zoom: 14,
    };
  }

  const points = [
    [model.anchor.latitude, model.anchor.longitude] as [number, number],
    ...model.stores.map(
      (store) => [store.latitude, store.longitude] as [number, number],
    ),
  ];

  if (points.length === 1) {
    return {
      kind: "center",
      center: points[0]!,
      zoom: 12,
    };
  }

  const latitudes = points.map(([latitude]) => latitude);
  const longitudes = points.map(([, longitude]) => longitude);

  return {
    kind: "bounds",
    southWest: [Math.min(...latitudes), Math.min(...longitudes)],
    northEast: [Math.max(...latitudes), Math.max(...longitudes)],
  };
}
