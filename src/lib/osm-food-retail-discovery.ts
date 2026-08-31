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

/** Minimum spacing between Overpass requests (cron ingest and search-time discovery). */
export const OSM_OVERPASS_MIN_INTERVAL_MS = 1_000;
/** Live Overpass catalog provenance — never used for synthetic map fixtures. */
export const OSM_MAP_CATALOG_SOURCE = "openstreetmap-overpass";
/** Rehearsal map-fixture provenance — never written as live Overpass. */
export const OSM_MAP_FIXTURE_SOURCE = "yum4less-map-fixture";
/** Catalog id prefix for synthetic fixture OSM rows (distinct from live `osm-`). */
export const OSM_MAP_FIXTURE_ID_PREFIX = "fixture-osm-";
/** Legacy synthetic osmId band previously upserted as live-looking `osm-node-90000*`. */
const LEGACY_SYNTHETIC_OSM_ID_RE = /^osm-(node|way)-90000\d+$/;

/** True for the rehearsal numeric osmId band (90000x), whether live or fixture prefixed. */
export function isSyntheticFixtureOsmNumericId(osmId: number): boolean {
  return osmId >= 900000 && osmId < 901000;
}

const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const FALLBACK_OVERPASS_ENDPOINT = "https://overpass.kumi.systems/api/interpreter";
const OVERPASS_USER_AGENT = "Yum4Less/0.1 (beta map-catalog ingest; +https://github.com/)";
const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
const DEFAULT_QUERY_TIMEOUT_S = 35;
const DEFAULT_ENDPOINT_ATTEMPTS = 2;
const DEFAULT_ENDPOINT_BACKOFF_MS = 2_000;

export function resolveOverpassEndpoints(): string[] {
  const configured = process.env.YUM4LESS_OSM_OVERPASS_URL?.trim();
  const endpoints = [
    configured || DEFAULT_OVERPASS_ENDPOINT,
    DEFAULT_OVERPASS_ENDPOINT,
    FALLBACK_OVERPASS_ENDPOINT,
  ];

  return [...new Set(endpoints.filter(Boolean))];
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * OSM `shop=*` values Yum4Less treats as grocery-related map context.
 * Excludes department_store, variety_store, general, kiosk, etc. (Marshalls, Kohl's, Five Below).
 */
export const GROCERY_OSM_SHOP_TAG_ALLOWLIST = [
  "supermarket",
  "greengrocer",
  "bakery",
  "butcher",
  "seafood",
  "deli",
  "convenience",
  "wholesale",
] as const;

export type GroceryOsmShopTag = (typeof GROCERY_OSM_SHOP_TAG_ALLOWLIST)[number];

const GROCERY_OSM_SHOP_TAG_SET = new Set<string>(GROCERY_OSM_SHOP_TAG_ALLOWLIST);

export function isAllowedGroceryOsmShopTag(shopTag: string): shopTag is GroceryOsmShopTag {
  return GROCERY_OSM_SHOP_TAG_SET.has(shopTag.trim());
}

/** Target grocery is often `shop=department_store`; do not keep Marshalls/Kohl's. */
export function isTargetGroceryBannerName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized.includes("target")) {
    return false;
  }
  if (
    normalized.includes("optical") ||
    normalized.includes("pharmacy") ||
    normalized.includes("cafe")
  ) {
    return false;
  }
  return (
    normalized === "target" ||
    normalized.startsWith("target ") ||
    normalized.includes("super target")
  );
}

export function shouldKeepOsmFoodRetailShop(shopTag: string, name: string): boolean {
  if (isAllowedGroceryOsmShopTag(shopTag)) {
    return true;
  }
  return shopTag.trim() === "department_store" && isTargetGroceryBannerName(name);
}

const FOOD_RETAIL_SHOP_TAGS = GROCERY_OSM_SHOP_TAG_ALLOWLIST.join("|");

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

export type OsmCatalogIdentityMode = {
  /** When true, emit fixture-osm-* ids and yum4less-map-fixture provenance. */
  fixture?: boolean;
};

export function buildOsmCatalogStoreId(
  store: OsmDiscoveredFoodRetailStore,
  options?: OsmCatalogIdentityMode,
): string {
  if (options?.fixture) {
    return `${OSM_MAP_FIXTURE_ID_PREFIX}${store.osmType}-${store.osmId}`;
  }

  return `osm-${store.osmType}-${store.osmId}`;
}

export function isFixtureOsmStoreId(storeId: string): boolean {
  return storeId.startsWith(OSM_MAP_FIXTURE_ID_PREFIX);
}

/** Live Overpass catalog ids only — excludes fixture-osm-* and legacy synthetic osm-node-90000*. */
export function isLiveOsmStoreId(storeId: string): boolean {
  if (isFixtureOsmStoreId(storeId) || LEGACY_SYNTHETIC_OSM_ID_RE.test(storeId)) {
    return false;
  }

  return storeId.startsWith("osm-");
}

/** Any OSM-style map pin id (live, fixture, or legacy synthetic). */
export function isOsmStyleStoreId(storeId: string): boolean {
  return (
    isFixtureOsmStoreId(storeId) ||
    storeId.startsWith("osm-") ||
    LEGACY_SYNTHETIC_OSM_ID_RE.test(storeId)
  );
}

export function isFixtureOsmCatalogSource(sourceName: string | null | undefined): boolean {
  return sourceName === OSM_MAP_FIXTURE_SOURCE;
}

/** True when a row must never be treated as live Overpass storefront truth. */
export function isNonLiveOsmCatalogIdentity(input: {
  id: string;
  sourceName?: string | null;
}): boolean {
  return (
    isFixtureOsmStoreId(input.id) ||
    isFixtureOsmCatalogSource(input.sourceName) ||
    LEGACY_SYNTHETIC_OSM_ID_RE.test(input.id)
  );
}

function filterFixtureStoresByRadius(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  zipCode?: string;
}): OsmDiscoveredFoodRetailStore[] {
  if (input.zipCode && input.zipCode !== "23111") {
    return [];
  }

  return fixtureOsmFoodRetailStores23111.filter(
    (store) =>
      isAllowedGroceryOsmShopTag(store.shopTag) &&
      getDistanceMiles(
        input.latitude,
        input.longitude,
        store.latitude,
        store.longitude,
      ) <= input.radiusMiles,
  );
}

async function fetchOverpassWithFallback(query: string): Promise<{
  response: Response;
  endpoint: string;
}> {
  const endpoints = resolveOverpassEndpoints();
  const timeoutMs = readPositiveIntEnv(
    "YUM4LESS_OSM_OVERPASS_TIMEOUT_MS",
    DEFAULT_FETCH_TIMEOUT_MS,
  );
  const maxAttempts = readPositiveIntEnv(
    "YUM4LESS_OSM_OVERPASS_MAX_ATTEMPTS",
    DEFAULT_ENDPOINT_ATTEMPTS,
  );
  const backoffMs = readPositiveIntEnv(
    "YUM4LESS_OSM_OVERPASS_ENDPOINT_BACKOFF_MS",
    DEFAULT_ENDPOINT_BACKOFF_MS,
  );

  let lastResponse: Response | undefined;
  let lastEndpoint = endpoints[0]!;
  let lastError: unknown;

  for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex += 1) {
    const endpoint = endpoints[endpointIndex]!;
    lastEndpoint = endpoint;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await respectOverpassRateLimit();

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json, text/plain, */*",
            "User-Agent": OVERPASS_USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(timeoutMs),
        });

        lastResponse = response;
        if (response.ok) {
          return { response, endpoint };
        }

        if (response.status === 406 || response.status === 429 || response.status >= 500) {
          break;
        }

        return { response, endpoint };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await sleep(backoffMs * attempt);
          continue;
        }
      }
    }

    if (endpointIndex < endpoints.length - 1) {
      await sleep(backoffMs);
    }
  }

  if (lastResponse) {
    return { response: lastResponse, endpoint: lastEndpoint };
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OSM Overpass discovery failed after retries.");
}

function buildOverpassQuery(input: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): string {
  const { latitude, longitude, radiusMeters } = input;
  const queryTimeoutSeconds = readPositiveIntEnv(
    "YUM4LESS_OSM_OVERPASS_QUERY_TIMEOUT_S",
    DEFAULT_QUERY_TIMEOUT_S,
  );

  return `
    [out:json][timeout:${queryTimeoutSeconds}];
    (
      node["shop"~"${FOOD_RETAIL_SHOP_TAGS}"](around:${radiusMeters},${latitude},${longitude});
      way["shop"~"${FOOD_RETAIL_SHOP_TAGS}"](around:${radiusMeters},${latitude},${longitude});
      node["shop"="department_store"]["name"~"Target",i](around:${radiusMeters},${latitude},${longitude});
      way["shop"="department_store"]["name"~"Target",i](around:${radiusMeters},${latitude},${longitude});
      node["shop"="department_store"]["brand"~"Target",i](around:${radiusMeters},${latitude},${longitude});
      way["shop"="department_store"]["brand"~"Target",i](around:${radiusMeters},${latitude},${longitude});
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

/**
 * Resolve a shopper-facing store label from OSM tags.
 * Priority: brand → operator → name (Food Lion and similar chains often omit name).
 */
export function resolveOsmFoodRetailDisplayName(
  tags: Record<string, string>,
): string | undefined {
  const brand = tags.brand?.trim();
  if (brand) {
    return brand;
  }

  const operator = tags.operator?.trim();
  if (operator) {
    return operator;
  }

  const name = tags.name?.trim();
  return name || undefined;
}

function resolveOsmShopTag(tags: Record<string, string>): string | undefined {
  const shopTag = tags.shop?.trim();
  if (shopTag) {
    return shopTag;
  }

  if (tags.amenity === "marketplace") {
    return "supermarket";
  }

  return undefined;
}

/** OSM lifecycle / closure tags that should not appear as active grocery map context. */
export function isDisusedOrClosedOsmFoodRetailElement(
  tags: Record<string, string>,
): boolean {
  const normalized = (value: string | undefined) => value?.trim().toLowerCase();

  if (["yes", "true", "1"].includes(normalized(tags.disused) ?? "")) {
    return true;
  }

  if (["yes", "true", "1"].includes(normalized(tags.abandoned) ?? "")) {
    return true;
  }

  if (["yes", "true", "1"].includes(normalized(tags.closed) ?? "")) {
    return true;
  }

  const operationalStatus = normalized(tags.operational_status);
  if (
    operationalStatus &&
    ["closed", "disused", "abandoned", "demolished"].includes(operationalStatus)
  ) {
    return true;
  }

  if (normalized(tags.building) === "abandoned") {
    return true;
  }

  if (tags["disused:shop"] || tags["was:shop"]) {
    return true;
  }

  return false;
}

export function parseOverpassElements(payload: OverpassResponse): OsmDiscoveredFoodRetailStore[] {
  const stores: OsmDiscoveredFoodRetailStore[] = [];

  for (const element of payload.elements ?? []) {
    const tags = element.tags ?? {};

    if (isDisusedOrClosedOsmFoodRetailElement(tags)) {
      continue;
    }

    const name = resolveOsmFoodRetailDisplayName(tags);
    const shopTag = resolveOsmShopTag(tags);

    if (!name || !shopTag || !shouldKeepOsmFoodRetailShop(shopTag, name)) {
      continue;
    }

    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;

    if (latitude === undefined || longitude === undefined) {
      continue;
    }

    const locality = resolveOsmAddressLocality(tags);

    stores.push({
      osmType: element.type,
      osmId: element.id,
      name,
      kind: inferStoreKind(shopTag, name),
      city: locality.city,
      state: locality.state,
      latitude,
      longitude,
      shopTag,
    });
  }

  return stores;
}

/** OSM address tags are often missing; do not invent the sentinel "Unknown". */
export function resolveOsmAddressLocality(tags: Record<string, string>): {
  city: string;
  state: string;
} {
  const city =
    tags["addr:city"]?.trim() ||
    tags["addr:town"]?.trim() ||
    tags["addr:suburb"]?.trim() ||
    "";
  const state = tags["addr:state"]?.trim() || "";
  return { city, state };
}

function inferStoreKind(
  shopTag: string,
  name: string,
): OsmDiscoveredFoodRetailStore["kind"] {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("dollar general")) {
    return "dollar-market";
  }

  if (
    shopTag === "wholesale" ||
    shopTag === "department_store" ||
    normalizedName.includes("costco") ||
    normalizedName.includes("sam's club") ||
    normalizedName.includes("bj")
  ) {
    return "big-box";
  }

  if (shopTag === "convenience") {
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
