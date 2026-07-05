import type { NearbyStoreSummary } from "@/lib/recommendation-types";

export type StoreNameLookupHints = {
  city?: string;
  state?: string;
};

/**
 * Join meal-card store names to catalog rows. Prefer storeId on plan items when
 * added (see shopping-plan-builder / meal-presentation TODOs).
 */
export function resolveNearbyStoreByName(
  storeName: string,
  nearbyStores: NearbyStoreSummary[],
  hints?: StoreNameLookupHints,
): NearbyStoreSummary | undefined {
  const trimmed = storeName.trim();
  const matches = nearbyStores.filter((store) => store.name === trimmed);

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const city = hints?.city?.trim().toLowerCase();
  const state = hints?.state?.trim().toLowerCase();

  if (city || state) {
    const disambiguated = matches.filter((store) => {
      const storeCity = store.city?.trim().toLowerCase();
      const storeState = store.state?.trim().toLowerCase();

      if (city && storeCity && city !== storeCity) {
        return false;
      }

      if (state && storeState && state !== storeState) {
        return false;
      }

      return true;
    });

    if (disambiguated.length === 1) {
      return disambiguated[0];
    }
  }

  return matches[0];
}

export function hasValidStoreCoordinates(
  store: NearbyStoreSummary | null | undefined,
): store is NearbyStoreSummary {
  return (
    store != null &&
    Number.isFinite(store.latitude) &&
    Number.isFinite(store.longitude)
  );
}
