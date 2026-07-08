import {
  isSyntheticFixtureOsmNumericId,
  type OsmDiscoveredFoodRetailStore,
} from "@/lib/osm-food-retail-discovery";
import { getDistanceMiles } from "@/lib/geo-distance";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";

export function isOsmAldiFoodRetailStore(store: OsmDiscoveredFoodRetailStore): boolean {
  return getProviderRolloutForStore(store.name).chain === "aldi";
}

/** Live OSM Aldi only — synthetic fixture numeric ids are never ranked-catalog truth. */
export function isLiveOsmAldiFoodRetailStore(
  store: OsmDiscoveredFoodRetailStore,
): boolean {
  return (
    isOsmAldiFoodRetailStore(store) && !isSyntheticFixtureOsmNumericId(store.osmId)
  );
}

export function findNearestOsmAldiStore(
  stores: OsmDiscoveredFoodRetailStore[],
  location: { latitude: number; longitude: number },
): OsmDiscoveredFoodRetailStore | undefined {
  const aldiStores = stores.filter(isLiveOsmAldiFoodRetailStore);
  if (aldiStores.length === 0) {
    return undefined;
  }

  return aldiStores
    .slice()
    .sort(
      (left, right) =>
        getDistanceMiles(
          location.latitude,
          location.longitude,
          left.latitude,
          left.longitude,
        ) -
        getDistanceMiles(
          location.latitude,
          location.longitude,
          right.latitude,
          right.longitude,
        ),
    )[0];
}
