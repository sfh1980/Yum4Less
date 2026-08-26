import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { allowsSeedZipGeocodingFallback } from "@/lib/runtime-environment";
import { isWithinContinentalUsBounds } from "@/lib/us-service-area";
import { readZipGeocodeCache } from "@/lib/zip-geocode-cache";

export type ResolvedZipLocation = {
  zipCode: string;
  city: string;
  state: string;
  county?: string;
  latitude: number;
  longitude: number;
  source: "geocodio" | "seed";
};

type GeocodeSuccess = {
  ok: true;
  location: ResolvedZipLocation;
  providerConfigured: boolean;
};

type GeocodeFailure = {
  ok: false;
  error: string;
  providerConfigured: boolean;
};

export type ZipLookupResult = GeocodeSuccess | GeocodeFailure;

type SeedZipLocation = Omit<ResolvedZipLocation, "source">;

const seedZipLocations: Record<string, SeedZipLocation> = {
  "23111": {
    zipCode: "23111",
    city: "Mechanicsville",
    state: "VA",
    county: "Hanover County",
    latitude: 37.6085,
    longitude: -77.3321,
  },
  "23116": {
    zipCode: "23116",
    city: "Mechanicsville",
    state: "VA",
    county: "Hanover County",
    latitude: 37.6652,
    longitude: -77.3651,
  },
  "23223": {
    zipCode: "23223",
    city: "Richmond",
    state: "VA",
    county: "Richmond City",
    latitude: 37.5349,
    longitude: -77.3789,
  },
  "23231": {
    zipCode: "23231",
    city: "Richmond",
    state: "VA",
    county: "Henrico County",
    latitude: 37.4894,
    longitude: -77.3222,
  },
};

/** Same ZIP must resolve to the same coords within a process (market-search vs rank). */
const zipLocationCache = new Map<string, ResolvedZipLocation>();

export function resetZipLocationCacheForTests() {
  zipLocationCache.clear();
}

export async function resolveZipLocation(zipCode: string): Promise<ZipLookupResult> {
  const normalizedZipCode = zipCode.trim();
  const cached = zipLocationCache.get(normalizedZipCode);
  if (cached) {
    return {
      ok: true,
      location: cached,
      providerConfigured: Boolean(process.env.GEOCODIO_API_KEY?.trim()),
    };
  }

  const durableCached = await readZipGeocodeCache(normalizedZipCode);
  if (durableCached) {
    return cacheZipLookupResult({
      ok: true,
      location: durableCached,
      providerConfigured: Boolean(process.env.GEOCODIO_API_KEY?.trim()),
    });
  }

  const geocodioKey = process.env.GEOCODIO_API_KEY?.trim();

  if (!geocodioKey) {
    if (!allowsSeedZipGeocodingFallback()) {
      return {
        ok: false,
        error:
          "GEOCODIO_API_KEY is required in production. Seed ZIP coordinates are disabled.",
        providerConfigured: false,
      };
    }

    return cacheZipLookupResult(
      getSeedFallback(
        normalizedZipCode,
        "Add GEOCODIO_API_KEY to enable live ZIP lookup outside the seeded local market.",
      ),
    );
  }

  const rateLimit = consumeRateLimit(
    "geocodio:global",
    RATE_LIMITS.geocodioUpstream,
  );
  if (!rateLimit.ok) {
    return cacheZipLookupResult(
      failOrSeedFallback(
        normalizedZipCode,
        "Live ZIP lookup is temporarily rate limited. Using local fallback when available.",
        true,
      ),
    );
  }

  try {
    const response = await fetch(
      `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(normalizedZipCode)}&api_key=${encodeURIComponent(geocodioKey)}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return cacheZipLookupResult(
        failOrSeedFallback(
          normalizedZipCode,
          "Live ZIP lookup is temporarily unavailable, and this ZIP is not in the local fallback set.",
          true,
        ),
      );
    }

    const payload = (await response.json()) as GeocodioResponse;
    const firstResult = payload.results?.[0];
    const parsedLocation = firstResult
      ? parseGeocodioResult(firstResult, normalizedZipCode)
      : undefined;

    if (parsedLocation) {
      if (
        !isWithinContinentalUsBounds({
          latitude: parsedLocation.latitude,
          longitude: parsedLocation.longitude,
        })
      ) {
        return {
          ok: false,
          error:
            "That ZIP is outside the continental US markets Yum4Less supports in this beta.",
          providerConfigured: true,
        };
      }

      zipLocationCache.set(normalizedZipCode, parsedLocation);
      return {
        ok: true,
        location: parsedLocation,
        providerConfigured: true,
      };
    }

    return cacheZipLookupResult(
      failOrSeedFallback(
        normalizedZipCode,
        "Geocodio did not return a usable location for that ZIP, and no local fallback exists for it yet.",
        true,
      ),
    );
  } catch {
    return cacheZipLookupResult(
      failOrSeedFallback(
        normalizedZipCode,
        "Live ZIP lookup failed, and this ZIP is not available in the local fallback set.",
        true,
      ),
    );
  }
}

function cacheZipLookupResult(result: ZipLookupResult): ZipLookupResult {
  if (result.ok) {
    zipLocationCache.set(result.location.zipCode, result.location);
  }
  return result;
}

function failOrSeedFallback(
  zipCode: string,
  message: string,
  providerConfigured = false,
): ZipLookupResult {
  if (!allowsSeedZipGeocodingFallback()) {
    return {
      ok: false,
      error: message,
      providerConfigured,
    };
  }

  return getSeedFallback(zipCode, message, providerConfigured);
}

function getSeedFallback(
  zipCode: string,
  missingSeedMessage: string,
  providerConfigured = false,
): ZipLookupResult {
  if (!allowsSeedZipGeocodingFallback()) {
    return {
      ok: false,
      error: missingSeedMessage,
      providerConfigured,
    };
  }

  const seedLocation = seedZipLocations[zipCode];

  if (!seedLocation) {
    return {
      ok: false,
      error: missingSeedMessage,
      providerConfigured,
    };
  }

  return {
    ok: true,
    location: {
      ...seedLocation,
      source: "seed",
    },
    providerConfigured,
  };
}

function parseGeocodioResult(
  result: GeocodioResponse["results"][number],
  zipCode: string,
): ResolvedZipLocation | undefined {
  const latitude = result.location?.lat;
  const longitude = result.location?.lng;
  const city = result.address_components?.city;
  const state = result.address_components?.state;

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !city ||
    !state
  ) {
    return undefined;
  }

  return {
    zipCode,
    city,
    state,
    county: result.address_components?.county,
    latitude,
    longitude,
    source: "geocodio",
  };
}

type GeocodioResponse = {
  results: Array<{
    location?: {
      lat?: number;
      lng?: number;
    };
    address_components?: {
      city?: string;
      state?: string;
      county?: string;
      zip?: string;
    };
    formatted_address?: string;
  }>;
};

export type StreetAddressGeocodeResult =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      formattedAddress?: string;
    }
  | {
      ok: false;
      reason: string;
    };

/** Forward-geocode a retailer street address for ingest location witnesses. */
export async function geocodeStreetAddress(input: {
  addressLine1: string;
  city: string;
  state: string;
  zipCode?: string;
}): Promise<StreetAddressGeocodeResult> {
  const geocodioKey = process.env.GEOCODIO_API_KEY;
  const addressLine1 = input.addressLine1.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const zipCode = input.zipCode?.trim();

  if (!geocodioKey) {
    return { ok: false, reason: "GEOCODIO_API_KEY is not configured." };
  }

  if (!addressLine1 || !city || !state) {
    return { ok: false, reason: "Street address geocoding requires address, city, and state." };
  }

  const rateLimit = consumeRateLimit(
    "geocodio:global",
    RATE_LIMITS.geocodioUpstream,
  );
  if (!rateLimit.ok) {
    return { ok: false, reason: "Geocodio rate limit reached." };
  }

  const query = [addressLine1, city, state, zipCode].filter(Boolean).join(", ");

  try {
    const response = await fetch(
      `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(geocodioKey)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: `Geocodio returned HTTP ${response.status} for store address lookup.`,
      };
    }

    const payload = (await response.json()) as GeocodioResponse;
    const firstResult = payload.results?.[0];
    const latitude = firstResult?.location?.lat;
    const longitude = firstResult?.location?.lng;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return { ok: false, reason: "Geocodio did not return coordinates for that address." };
    }

    if (
      !isWithinContinentalUsBounds({
        latitude,
        longitude,
      })
    ) {
      return { ok: false, reason: "Geocodio returned coordinates outside continental US bounds." };
    }

    return {
      ok: true,
      latitude,
      longitude,
      formattedAddress: firstResult?.formatted_address,
    };
  } catch {
    return { ok: false, reason: "Geocodio store address lookup failed unexpectedly." };
  }
}
