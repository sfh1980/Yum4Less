import { fixtureOsmFoodRetailStores23111 } from "@/lib/fixtures/osm-food-retail.fixtures";
import { logServerError } from "@/lib/server-log";

export type OsmDiscoveredFoodRetailStore = {
  osmType: "node" | "way";
  osmId: number;
  name: string;
  kind: "grocery" | "big-box" | "specialty" | "dollar-market";
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  shopTag: string;
};

export type OsmFoodRetailDiscoveryResult = {
  stores: OsmDiscoveredFoodRetailStore[];
  source: "openstreetmap-overpass" | "fixture";
  message: string;
};

/** Overpass usage: one query per ZIP per daily ingest; do not call on user search. */
export const OSM_OVERPASS_MIN_INTERVAL_MS = 1_000;
export const OSM_MAP_CATALOG_SOURCE = "openstreetmap-overpass";

const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const FALLBACK_OVERPASS_ENDPOINT = "https://overpass.kumi.systems/api/interpreter";
const OVERPASS_USER_AGENT = "Yum4Less/0.1 (beta map-catalog ingest; +https://github.com/)";

function resolveOverpassEndpoints(): string[] {
  const configured = process.env.YUM4LESS_OSM_OVERPASS_URL?.trim();
  const endpoints = [
    configured || DEFAULT_OVERPASS_ENDPOINT,
    DEFAULT_OVERPASS_ENDPOINT,
    FALLBACK_OVERPASS_ENDPOINT,
  ];

  return [...new Set(endpoints.filter(Boolean))];
}

const FOOD_RETAIL_SHOP_TAGS = [
  "supermarket",
  "convenience",
  "wholesale",
  "department_store",
  "variety_store",
  "general",
  "greengrocer",
  "bakery",
  "butcher",
  "seafood",
  "deli",
  "kiosk",
].join("|");

let lastOverpassRequestAt = 0;

export async function discoverFoodRetailStoresNearLocation(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
  useFixture?: boolean;
}): Promise<OsmFoodRetailDiscoveryResult> {
  if (input.useFixture || process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1") {
    return {
      stores: filterFixtureStoresByRadius(input),
      source: "fixture",
      message:
        "Using deterministic OSM-style fixture stores for map catalog ingest (not live Overpass).",
    };
  }

  try {
    await respectOverpassRateLimit();
    const radiusMeters = Math.round(input.radiusMiles * 1609.34);
    const query = buildOverpassQuery({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters,
    });

    const { response, endpoint } = await fetchOverpassWithFallback(query);

    if (!response.ok) {
      return {
        stores: [],
        source: "openstreetmap-overpass",
        message: `Overpass API returned HTTP ${response.status} from ${endpoint}; no OSM map-context stores ingested.`,
      };
    }

    const payload = (await response.json()) as OverpassResponse;
    const stores = parseOverpassElements(payload).filter(
      (store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude),
    );

    return {
      stores,
      source: "openstreetmap-overpass",
      message: `Discovered ${stores.length} OSM food-retail location(s) within ${input.radiusMiles} mi via ${endpoint}.`,
    };
  } catch (error) {
    logServerError("osm-food-retail-discovery", error);
    return {
      stores: [],
      source: "openstreetmap-overpass",
      message:
        error instanceof Error
          ? `OSM Overpass discovery failed: ${error.message}`
          : "OSM Overpass discovery failed unexpectedly.",
    };
  }
}

export function buildOsmCatalogStoreId(store: OsmDiscoveredFoodRetailStore): string {
  return `osm-${store.osmType}-${store.osmId}`;
}

function filterFixtureStoresByRadius(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
}): OsmDiscoveredFoodRetailStore[] {
  if (input.zipCode === "23111" || !input.zipCode) {
    return fixtureOsmFoodRetailStores23111.filter(
      (store) =>
        getDistanceMiles(
          input.latitude,
          input.longitude,
          store.latitude,
          store.longitude,
        ) <= input.radiusMiles,
    );
  }

  return [];
}

async function fetchOverpassWithFallback(query: string): Promise<{
  response: Response;
  endpoint: string;
}> {
  const endpoints = resolveOverpassEndpoints();
  let lastResponse: Response | undefined;
  let lastEndpoint = endpoints[0]!;

  for (const endpoint of endpoints) {
    lastEndpoint = endpoint;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
        "User-Agent": OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(30_000),
    });

    lastResponse = response;
    if (response.ok) {
      return { response, endpoint };
    }

    if (response.status === 406 || response.status === 429 || response.status >= 500) {
      continue;
    }

    return { response, endpoint };
  }

  return { response: lastResponse!, endpoint: lastEndpoint };
}

function buildOverpassQuery(input: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): string {
  const { latitude, longitude, radiusMeters } = input;

  return `
    [out:json][timeout:25];
    (
      node["shop"~"${FOOD_RETAIL_SHOP_TAGS}"](around:${radiusMeters},${latitude},${longitude});
      way["shop"~"${FOOD_RETAIL_SHOP_TAGS}"](around:${radiusMeters},${latitude},${longitude});
    );
    out center tags;
  `.trim();
}

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OverpassElement = {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function parseOverpassElements(payload: OverpassResponse): OsmDiscoveredFoodRetailStore[] {
  const stores: OsmDiscoveredFoodRetailStore[] = [];

  for (const element of payload.elements ?? []) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    const shopTag = tags.shop?.trim();

    if (!name || !shopTag) {
      continue;
    }

    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;

    if (latitude === undefined || longitude === undefined) {
      continue;
    }

    stores.push({
      osmType: element.type,
      osmId: element.id,
      name,
      kind: inferStoreKind(shopTag, name),
      city: tags["addr:city"]?.trim() || "Unknown",
      state: tags["addr:state"]?.trim() || "Unknown",
      latitude,
      longitude,
      shopTag,
    });
  }

  return stores;
}

function inferStoreKind(
  shopTag: string,
  name: string,
): OsmDiscoveredFoodRetailStore["kind"] {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("dollar general") || shopTag === "variety_store") {
    return "dollar-market";
  }

  if (
    shopTag === "department_store" ||
    shopTag === "wholesale" ||
    normalizedName.includes("costco") ||
    normalizedName.includes("sam's club") ||
    normalizedName.includes("bj")
  ) {
    return "big-box";
  }

  if (shopTag === "convenience" || shopTag === "kiosk") {
    return "specialty";
  }

  return "grocery";
}

async function respectOverpassRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastOverpassRequestAt;
  if (elapsed < OSM_OVERPASS_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, OSM_OVERPASS_MIN_INTERVAL_MS - elapsed),
    );
  }

  lastOverpassRequestAt = Date.now();
}

function getDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
