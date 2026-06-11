import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isWithinContinentalUsBounds } from "@/lib/us-service-area";

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

export async function resolveZipLocation(zipCode: string): Promise<ZipLookupResult> {
  const normalizedZipCode = zipCode.trim();
  const geocodioKey = process.env.GEOCODIO_API_KEY;

  if (!geocodioKey) {
    return getSeedFallback(
      normalizedZipCode,
      "Add GEOCODIO_API_KEY to enable live ZIP lookup outside the seeded local market.",
    );
  }

  const rateLimit = consumeRateLimit(
    "geocodio:global",
    RATE_LIMITS.geocodioUpstream,
  );
  if (!rateLimit.ok) {
    return getSeedFallback(
      normalizedZipCode,
      "Live ZIP lookup is temporarily rate limited. Using local fallback when available.",
      true,
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
      return getSeedFallback(
        normalizedZipCode,
        "Live ZIP lookup is temporarily unavailable, and this ZIP is not in the local fallback set.",
        true,
      );
    }

    const payload = (await response.json()) as GeocodioResponse;
    const firstResult = payload.results?.[0];
    const parsedLocation = firstResult ? parseGeocodioResult(firstResult, normalizedZipCode) : undefined;

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

      return {
        ok: true,
        location: parsedLocation,
        providerConfigured: true,
      };
    }

    return getSeedFallback(
      normalizedZipCode,
      "Geocodio did not return a usable location for that ZIP, and no local fallback exists for it yet.",
      true,
    );
  } catch {
    return getSeedFallback(
      normalizedZipCode,
      "Live ZIP lookup failed, and this ZIP is not available in the local fallback set.",
      true,
    );
  }
}

function getSeedFallback(
  zipCode: string,
  missingSeedMessage: string,
  providerConfigured = false,
): ZipLookupResult {
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
    };
  }>;
};
