import type { NearbyStoreSummary } from "@/lib/recommendation-types";

export const APPROXIMATE_LOCATION_LABEL = "Approximate location";

function isUnknownLocationValue(value?: string): boolean {
  return value?.trim().toLowerCase() === "unknown";
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

/** Primary line: store name plus city/state when known. */
export function formatStoreNameWithLocation(
  store: Pick<NearbyStoreSummary, "name"> & { city?: string; state?: string },
): string {
  const location = formatStoreCityState(store);
  return location ? `${store.name} — ${location}` : store.name;
}

/** Settings dropdown / multi-select option text. */
export function formatSettingsStoreOptionLabel(
  store: Pick<NearbyStoreSummary, "name" | "distanceMiles"> & {
    city?: string;
    state?: string;
  },
): string {
  return `${formatStoreNameWithLocation(store)} (${store.distanceMiles} mi)`;
}
