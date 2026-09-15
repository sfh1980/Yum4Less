import {
  buildTargetApiHeaders,
  resolveTargetApiKey,
  TARGET_NEARBY_STORES_URL,
} from "@/lib/weekly-ad-ingestion/target-weekly-ad-api";

export type TargetLocatorStore = {
  storeId: string;
  locationName: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  addressLine1?: string;
};

export type TargetWeeklyAdStoreDeps = {
  fetchJson?: (url: string) => Promise<{ status: number; json: unknown }>;
};

export async function resolveTargetStoreForZip(
  zipCode: string,
  deps?: TargetWeeklyAdStoreDeps,
): Promise<TargetLocatorStore | undefined> {
  const trimmedZip = zipCode.trim();
  if (!/^\d{5}$/.test(trimmedZip)) {
    return undefined;
  }

  const overrideStoreId = process.env.TARGET_STORE_NUMBER?.trim();
  if (overrideStoreId && /^\d+$/.test(overrideStoreId)) {
    return {
      storeId: overrideStoreId,
      locationName: process.env.TARGET_STORE_NAME?.trim() || "Target",
      city: process.env.TARGET_STORE_CITY?.trim() || "Unknown",
      state: process.env.TARGET_STORE_STATE?.trim() || "US",
      latitude: readOptionalEnvNumber("TARGET_STORE_LATITUDE"),
      longitude: readOptionalEnvNumber("TARGET_STORE_LONGITUDE"),
    };
  }

  const fetchJson = deps?.fetchJson ?? fetchTargetJson;
  const key = resolveTargetApiKey();
  const url = new URL(TARGET_NEARBY_STORES_URL);
  url.searchParams.set("key", key);
  url.searchParams.set("place", trimmedZip);
  url.searchParams.set("limit", "5");
  url.searchParams.set("within", "25");
  url.searchParams.set("unit", "mile");
  url.searchParams.set("channel", "WEB");

  const response = await fetchJson(url.toString());
  if (response.status !== 200) {
    return undefined;
  }

  const stores = readNearbyStores(response.json);
  return stores[0];
}

export function buildTargetCatalogStoreId(storeId: string): string {
  return `target-${storeId}`;
}

async function fetchTargetJson(url: string): Promise<{ status: number; json: unknown }> {
  const response = await fetch(url, {
    headers: buildTargetApiHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, json };
}

function readNearbyStores(payload: unknown): TargetLocatorStore[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const data = asRecord(root.data);
  const nearby = asRecord(data?.nearby_stores);
  const stores = Array.isArray(nearby?.stores) ? nearby.stores : [];

  return stores
    .map((entry) => normalizeLocatorStore(entry))
    .filter((store): store is TargetLocatorStore => Boolean(store));
}

function normalizeLocatorStore(entry: unknown): TargetLocatorStore | undefined {
  const record = asRecord(entry);
  if (!record) {
    return undefined;
  }

  const storeId = readString(record.store_id) ?? readString(record.storeId);
  if (!storeId || !/^\d+$/.test(storeId)) {
    return undefined;
  }

  const mailing = asRecord(record.mailing_address) ?? asRecord(record.address);
  const geo =
    asRecord(record.geographic_specifications) ??
    asRecord(record.geographicSpecifications) ??
    asRecord(record.location);

  const latitude =
    readNumber(record.latitude) ??
    readNumber(geo?.latitude) ??
    readNumber(geo?.lat);
  const longitude =
    readNumber(record.longitude) ??
    readNumber(geo?.longitude) ??
    readNumber(geo?.lng) ??
    readNumber(geo?.lon);

  const city =
    readString(mailing?.city) ??
    readString(record.city) ??
    readString(record.location_name) ??
    "Unknown";
  const state =
    readString(mailing?.region) ??
    readString(mailing?.state) ??
    readString(record.state) ??
    "US";

  return {
    storeId,
    locationName:
      readString(record.location_name) ??
      readString(record.store_name) ??
      `Target ${city}`,
    city,
    state: state.length === 2 ? state.toUpperCase() : state,
    latitude,
    longitude,
    distanceMiles: readNumber(record.distance),
    addressLine1: readString(mailing?.address_line1) ?? readString(mailing?.address_line_1),
  };
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
