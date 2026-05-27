import { resolveZipLocation } from "@/lib/geocoding";
import { isWithinMvpBrowserRadius } from "@/lib/mvp-area";

export type ResolvedSearchLocation = {
  zipCode?: string;
  city: string;
  state: string;
  county?: string;
  latitude: number;
  longitude: number;
  source: "geocodio" | "seed" | "browser";
};

export type LocationResolutionResult =
  | {
      ok: true;
      location: ResolvedSearchLocation;
      providerConfigured: boolean;
    }
  | {
      ok: false;
      error: string;
      providerConfigured: boolean;
    };

export async function resolveLocationInput(input: {
  zipCode?: string;
  latitude?: number;
  longitude?: number;
}): Promise<LocationResolutionResult> {
  const hasCoordinates =
    typeof input.latitude === "number" && typeof input.longitude === "number";

  if (hasCoordinates) {
    if (
      input.latitude! < -90 ||
      input.latitude! > 90 ||
      input.longitude! < -180 ||
      input.longitude! > 180
    ) {
      return {
        ok: false,
        error: "Browser location coordinates are out of range.",
        providerConfigured: Boolean(process.env.GEOCODIO_API_KEY),
      };
    }

    if (
      !isWithinMvpBrowserRadius({
        latitude: input.latitude!,
        longitude: input.longitude!,
      })
    ) {
      return {
        ok: false,
        error:
          "Browser location is outside the current Yum4Less MVP service area near ZIP 23111. Try entering a local ZIP code instead.",
        providerConfigured: Boolean(process.env.GEOCODIO_API_KEY),
      };
    }

    return {
      ok: true,
      location: {
        city: "Current location",
        state: "VA",
        latitude: input.latitude!,
        longitude: input.longitude!,
        source: "browser",
      },
      providerConfigured: Boolean(process.env.GEOCODIO_API_KEY),
    };
  }

  const zipCode = input.zipCode?.trim();
  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    return {
      ok: false,
      error: "Enter a valid 5-digit ZIP code or use browser location.",
      providerConfigured: Boolean(process.env.GEOCODIO_API_KEY),
    };
  }

  return resolveZipLocation(zipCode);
}
