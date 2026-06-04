import type {
  MarketSummary,
  NearbyStoreSummary,
} from "@/lib/recommendation-service";
import type { StoreChain } from "@/lib/provider-rollout";

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
};

export type NearbyStoresMapModel = {
  anchor: {
    latitude: number;
    longitude: number;
    label: string;
    source: MapAnchorSource;
  };
  radiusMiles: number;
  stores: MapStoreMarker[];
  trustNote: string;
};

export function buildNearbyStoresMapModel(
  market: Pick<
    MarketSummary,
    | "nearbyStores"
    | "searchLatitude"
    | "searchLongitude"
    | "locationLabel"
    | "lookupSource"
    | "radiusMiles"
    | "dataSource"
  >,
): NearbyStoresMapModel {
  const source = toMapAnchorSource(market.lookupSource);

  return {
    anchor: {
      latitude: market.searchLatitude,
      longitude: market.searchLongitude,
      label: market.locationLabel,
      source,
    },
    radiusMiles: market.radiusMiles,
    stores: market.nearbyStores.map((store) => ({
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
    })),
    trustNote: buildMapTrustNote(market.dataSource, source),
  };
}

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

function buildMapTrustNote(
  dataSource: MarketSummary["dataSource"],
  anchorSource: MapAnchorSource,
) {
  const storeSource =
    dataSource === "database"
      ? "saved local store locations with weekly ad prices when available"
      : "saved store prices that are not loading right now — map pins may stay empty until they return";
  const anchorLabel =
    anchorSource === "browser"
      ? "your current browser location"
      : anchorSource === "zip"
        ? "the ZIP you searched"
        : "the local MVP area";

  return `Map pins use ${storeSource}, anchored to ${anchorLabel}. Walmart pins are context only—current, actionable Walmart pricing is not available yet. Store lookups are shown separately and do not replace these map pins yet.`;
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

export function getMapBounds(model: NearbyStoresMapModel): MapBoundsResult {
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
