import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";
import { BROWSER_FETCH_TIMEOUT_MS } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-fetcher";
import {
  WHOLE_FOODS_CLOSEST_STORE_PATH,
  WHOLE_FOODS_STORES_URL,
  buildWholeFoodsBrowserHeaders,
  buildWholeFoodsStoreSummaryUrl,
} from "@/lib/weekly-ad-ingestion/whole-foods-weekly-ad-api";

export type WholeFoodsLocatorStore = {
  storeId: string;
  locationName: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  addressLine1?: string;
  postalCode?: string;
};

export type WholeFoodsWeeklyAdStoreDeps = {
  fetchClosest?: (zipCode: string) => Promise<{ storeId: string } | undefined>;
  fetchSummary?: (
    storeId: string,
  ) => Promise<Partial<WholeFoodsLocatorStore> | undefined>;
  geocodeZip?: (
    zipCode: string,
  ) => Promise<{ latitude: number; longitude: number } | undefined>;
};

export function buildWholeFoodsCatalogStoreId(storeId: string): string {
  return `whole-foods-${storeId}`;
}

export function readWholeFoodsStoreIdFromPayload(
  payload: unknown,
): string | undefined {
  const record = asRecord(payload);
  if (!record) {
    return undefined;
  }

  const storeId =
    readDigits(record.storeCode) ??
    readDigits(record.storeId) ??
    readDigits(record.pickupStoreCode) ??
    readDigits(record.bu);
  return storeId;
}

export async function resolveWholeFoodsStoreForZip(
  zipCode: string,
  deps?: WholeFoodsWeeklyAdStoreDeps,
): Promise<WholeFoodsLocatorStore | undefined> {
  const trimmedZip = zipCode.trim();
  if (!/^\d{5}$/.test(trimmedZip)) {
    return undefined;
  }

  const overrideStoreId = process.env.WHOLE_FOODS_STORE_NUMBER?.trim();
  if (overrideStoreId && /^\d+$/.test(overrideStoreId)) {
    const summary =
      (await (deps?.fetchSummary ?? fetchWholeFoodsStoreSummary)(overrideStoreId)) ??
      {};
    return {
      storeId: overrideStoreId,
      locationName:
        process.env.WHOLE_FOODS_STORE_NAME?.trim() ||
        summary.locationName ||
        "Whole Foods Market",
      city: process.env.WHOLE_FOODS_STORE_CITY?.trim() || summary.city || "Unknown",
      state: process.env.WHOLE_FOODS_STORE_STATE?.trim() || summary.state || "US",
      latitude: readOptionalEnvNumber("WHOLE_FOODS_STORE_LATITUDE") ?? summary.latitude,
      longitude:
        readOptionalEnvNumber("WHOLE_FOODS_STORE_LONGITUDE") ?? summary.longitude,
      addressLine1: summary.addressLine1,
      postalCode: summary.postalCode,
    };
  }

  const fetchClosest = deps?.fetchClosest ?? defaultFetchClosest(deps);
  const closest = await fetchClosest(trimmedZip);
  if (!closest?.storeId) {
    return undefined;
  }

  const summary =
    (await (deps?.fetchSummary ?? fetchWholeFoodsStoreSummary)(closest.storeId)) ??
    {};

  return {
    storeId: closest.storeId,
    locationName: summary.locationName || "Whole Foods Market",
    city: summary.city || "Unknown",
    state: summary.state || "US",
    latitude: summary.latitude,
    longitude: summary.longitude,
    addressLine1: summary.addressLine1,
    postalCode: summary.postalCode,
  };
}

function defaultFetchClosest(
  deps?: WholeFoodsWeeklyAdStoreDeps,
): (zipCode: string) => Promise<{ storeId: string } | undefined> {
  return async (zipCode) => {
    if (process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER === "1") {
      return undefined;
    }

    const geocode = deps?.geocodeZip ?? geocodeZipForWholeFoodsLocator;
    const coords = await geocode(zipCode);
    if (!coords) {
      return undefined;
    }

    return fetchWholeFoodsClosestStoreWithBrowser({
      zipCode,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
  };
}

async function geocodeZipForWholeFoodsLocator(
  zipCode: string,
): Promise<{ latitude: number; longitude: number } | undefined> {
  const { resolveZipLocation } = await import("@/lib/geocoding");
  const result = await resolveZipLocation(zipCode);
  if (!result.ok) {
    return undefined;
  }
  return {
    latitude: result.location.latitude,
    longitude: result.location.longitude,
  };
}

export async function fetchWholeFoodsClosestStoreWithBrowser(input: {
  zipCode: string;
  latitude: number;
  longitude: number;
}): Promise<{ storeId: string } | undefined> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const timeoutMs = BROWSER_FETCH_TIMEOUT_MS;

  try {
    const context = await browser.newContext({
      ...getWeeklyAdBrowserContextOptions(),
      geolocation: { latitude: input.latitude, longitude: input.longitude },
      permissions: ["geolocation"],
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    let storeId: string | undefined;
    const closestWait = page
      .waitForResponse(
        (response) =>
          response.url().includes(WHOLE_FOODS_CLOSEST_STORE_PATH) &&
          response.status() === 200,
        { timeout: Math.min(timeoutMs, 15_000) },
      )
      .catch(() => null);

    await page.goto(`${WHOLE_FOODS_STORES_URL}?openStoreSelector=true`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    // ZIP is resolved to coordinates before this call; the retailer closest-store
    // API is session-bound and keyed from geolocation, not the typed ZIP field.
    void input.zipCode;

    const closestResponse = await closestWait;
    if (closestResponse) {
      storeId = readWholeFoodsStoreIdFromPayload(await closestResponse.json().catch(() => null));
    }

    if (!storeId) {
      await page.waitForTimeout(2_000);
    }

    return storeId ? { storeId } : undefined;
  } finally {
    await browser.close();
  }
}

export async function fetchWholeFoodsStoreSummary(
  storeId: string,
): Promise<Partial<WholeFoodsLocatorStore> | undefined> {
  const response = await fetch(buildWholeFoodsStoreSummaryUrl(storeId), {
    headers: buildWholeFoodsBrowserHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    return undefined;
  }

  const json = (await response.json().catch(() => null)) as unknown;
  return normalizeStoreSummary(json, storeId);
}

function normalizeStoreSummary(
  payload: unknown,
  fallbackStoreId: string,
): Partial<WholeFoodsLocatorStore> | undefined {
  const record = asRecord(payload);
  if (!record) {
    return undefined;
  }

  const storeId = readWholeFoodsStoreIdFromPayload(record) ?? fallbackStoreId;
  const location = asRecord(record.primaryLocation);
  const address = asRecord(location?.address);
  const latLng = parseLatLngFromDirections(record);

  const city =
    readString(address?.CITY) ??
    readString(address?.city) ??
    readString(record.city);
  const state =
    readString(address?.STATE) ??
    readString(address?.state) ??
    readString(record.state);
  const postal =
    readString(address?.ZIP_CODE) ??
    readString(address?.POSTAL_CODE) ??
    readString(address?.postalCode);

  return {
    storeId,
    locationName:
      readString(record.displayName) ??
      readString(record.storeName) ??
      "Whole Foods Market",
    city,
    state: state && state.length === 2 ? state.toUpperCase() : state,
    latitude:
      readNumber(location?.latitude) ??
      readNumber(record.latitude) ??
      latLng?.latitude,
    longitude:
      readNumber(location?.longitude) ??
      readNumber(record.longitude) ??
      latLng?.longitude,
    addressLine1:
      readString(address?.STREET_ADDRESS_LINE1) ??
      readString(address?.addressLine1),
    postalCode: postal?.replace(/-\d+$/, ""),
  };
}

function parseLatLngFromDirections(
  record: Record<string, unknown>,
): { latitude: number; longitude: number } | undefined {
  const links = asRecord(record.links);
  const directions = readString(links?.Directions);
  if (!directions) {
    return undefined;
  }
  const match = directions.match(/destination=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  const latitude = Number.parseFloat(match[1]);
  const longitude = Number.parseFloat(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }
  return { latitude, longitude };
}

function readOptionalEnvNumber(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readDigits(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  return undefined;
}
