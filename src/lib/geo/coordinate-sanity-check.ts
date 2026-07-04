import { getDistanceMiles } from "@/lib/geo-distance";

export type SanityFlagReason =
  | "coordinate_delta"
  | "unknown_city_state"
  | "unverifiable_address"
  | "missing_address";

export interface CoordinateSanityResult {
  ok: boolean;
  deltaMiles: number | null;
  storedCoords: { lat: number; lon: number };
  suggestedCoords: { lat: number; lon: number } | null;
  flagReasons: SanityFlagReason[];
}

export interface StoreForSanityCheck {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  geocodeCity?: string | null;
  geocodeState?: string | null;
  geocodeZip?: string | null;
  lat: number;
  lon: number;
}

export type CoordinateSanityCheckOptions = {
  thresholdMiles?: number;
  requestDelayMs?: number;
  retryBackoffMs?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_THRESHOLD_MILES = 0.25;
const DEFAULT_REQUEST_DELAY_MS = 1_000;
const DEFAULT_RETRY_BACKOFF_MS = 5_000;
const DEFAULT_NOMINATIM_USER_AGENT =
  "Yum4Less/1.0 (contact: local-dev@example.invalid)";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

type NominatimSearchResult = {
  lat?: string;
  lon?: string;
};

export async function checkCoordinateSanity(
  store: StoreForSanityCheck,
  options: CoordinateSanityCheckOptions = {},
): Promise<CoordinateSanityResult> {
  const storedCoords = { lat: store.lat, lon: store.lon };
  const address = normalizeText(store.address);
  const thresholdMiles = options.thresholdMiles ?? DEFAULT_THRESHOLD_MILES;
  const cityOrStateUnknown =
    isUnknownText(store.city) || isUnknownText(store.state);

  if (!address) {
    const flagReasons = computeFlagReasons({
      hasAddress: false,
      geocodeSucceeded: false,
      cityOrStateUnknown,
      deltaMiles: null,
      thresholdMiles,
    });
    return {
      ok: flagReasons.length === 0,
      deltaMiles: null,
      storedCoords,
      suggestedCoords: null,
      flagReasons,
    };
  }

  const geocoded = await geocodeAddressWithNominatim(
    buildAddressQuery(store),
    options,
  );
  if (!geocoded) {
    const flagReasons = computeFlagReasons({
      hasAddress: true,
      geocodeSucceeded: false,
      cityOrStateUnknown,
      deltaMiles: null,
      thresholdMiles,
    });
    return {
      ok: flagReasons.length === 0,
      deltaMiles: null,
      storedCoords,
      suggestedCoords: null,
      flagReasons,
    };
  }

  const deltaMiles = getDistanceMiles(
    store.lat,
    store.lon,
    geocoded.lat,
    geocoded.lon,
  );
  const flagReasons = computeFlagReasons({
    hasAddress: true,
    geocodeSucceeded: true,
    cityOrStateUnknown,
    deltaMiles,
    thresholdMiles,
  });

  return {
    ok: flagReasons.length === 0,
    deltaMiles,
    storedCoords,
    suggestedCoords: geocoded,
    flagReasons,
  };
}

export async function checkCoordinateSanityBatch(
  stores: StoreForSanityCheck[],
  options: CoordinateSanityCheckOptions = {},
): Promise<Map<string, CoordinateSanityResult>> {
  const results = new Map<string, CoordinateSanityResult>();
  const sleep = options.sleep ?? defaultSleep;
  const requestDelayMs = options.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;

  for (let index = 0; index < stores.length; index += 1) {
    if (index > 0) {
      await sleep(requestDelayMs);
    }

    const store = stores[index]!;
    results.set(store.id, await checkCoordinateSanity(store, options));
  }

  return results;
}

async function geocodeAddressWithNominatim(
  query: string,
  options: CoordinateSanityCheckOptions,
): Promise<{ lat: number; lon: number } | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
  const userAgent =
    normalizeText(options.userAgent) ??
    normalizeText(process.env.YUM4LESS_NOMINATIM_USER_AGENT) ??
    DEFAULT_NOMINATIM_USER_AGENT;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const url = new URL(NOMINATIM_SEARCH_URL);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("q", query);

      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": userAgent,
        },
        cache: "no-store",
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt === 0) {
          await sleep(retryBackoffMs);
          continue;
        }

        return null;
      }

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as NominatimSearchResult[];
      const first = payload[0];
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      return { lat, lon };
    } catch {
      if (attempt === 0) {
        await sleep(retryBackoffMs);
        continue;
      }

      return null;
    }
  }

  return null;
}

function buildAddressQuery(store: StoreForSanityCheck): string {
  const address = normalizeAddressForGeocodeQuery(normalizeText(store.address));
  return [
    address,
    normalizeText(store.geocodeCity ?? store.city),
    normalizeText(store.geocodeState ?? store.state),
    normalizeText(store.geocodeZip ?? store.zip),
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/** Nominatim often indexes "Marketplace" as one word while SNAP/OSM tags use "Market Place". */
export function normalizeAddressForGeocodeQuery(
  address: string | null | undefined,
): string | null {
  const normalized = normalizeText(address);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\bmarket\s+place\b/gi, "Marketplace");
}

function computeFlagReasons(input: {
  hasAddress: boolean;
  geocodeSucceeded: boolean;
  cityOrStateUnknown: boolean;
  deltaMiles: number | null;
  thresholdMiles: number;
}): SanityFlagReason[] {
  const reasons: SanityFlagReason[] = [];

  if (!input.hasAddress) {
    reasons.push("missing_address");
  } else if (!input.geocodeSucceeded) {
    reasons.push("unverifiable_address");
  }

  if (input.cityOrStateUnknown) {
    reasons.push("unknown_city_state");
  }

  if (
    input.deltaMiles !== null &&
    input.deltaMiles > input.thresholdMiles
  ) {
    reasons.push("coordinate_delta");
  }

  return reasons;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isUnknownText(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "unknown";
}

async function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}
