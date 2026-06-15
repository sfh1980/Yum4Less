import {
  KROGER_API_SPEC,
  getKrogerApiBaseUrl,
  getKrogerApiEnvironment,
  readKrogerItemPrices,
  type KrogerLocation,
  type KrogerLocationSearchFilters,
  type KrogerLocationsResponse,
  type KrogerProduct,
  type KrogerProductSearchFilters,
  type KrogerProductsResponse,
} from "@/lib/providers/kroger/kroger-api-types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const DEFAULT_TOKEN_TTL_MS = 30 * 60 * 1000;

type CachedKrogerAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};

const krogerAccessTokenCache = new Map<string, CachedKrogerAccessToken>();
const krogerAccessTokenInFlight = new Map<string, Promise<string>>();

/** Clears in-memory Kroger OAuth tokens between Vitest cases. */
export function resetKrogerAccessTokenCacheForTests() {
  krogerAccessTokenCache.clear();
  krogerAccessTokenInFlight.clear();
}

export type KrogerApiCredentials = {
  clientId: string;
  clientSecret: string;
};

export type KrogerApiClient = ReturnType<typeof createKrogerApiClient>;

export type KrogerItemPriceSummary = {
  regularPrice?: number;
  promoPrice?: number;
  resolvedPrice?: number;
  hasPromo?: boolean;
};

export type KrogerApiSetupProbe = {
  configured: boolean;
  environment: ReturnType<typeof getKrogerApiEnvironment>;
  baseUrl: string;
  tokenOk: boolean;
  locationId?: string;
  catalogOk: boolean;
  pricingAvailable: boolean;
  sampleProductDescription?: string;
  productId?: string;
  searchPriceSummary?: KrogerItemPriceSummary;
  detailPriceSummary?: KrogerItemPriceSummary;
  detailCatalogOk?: boolean;
  productionPromotionReady?: boolean;
  productionPromotionSteps?: string[];
  message: string;
};

export async function probeKrogerApiSetup(
  zipCode = "23111",
  input?: Partial<KrogerApiCredentials>,
): Promise<KrogerApiSetupProbe> {
  const environment = getKrogerApiEnvironment();
  const baseUrl = getKrogerApiBaseUrl();
  const api = createKrogerApiClient(input);

  if (!api.isConfigured) {
    return {
      configured: false,
      environment,
      baseUrl,
      tokenOk: false,
      catalogOk: false,
      pricingAvailable: false,
      message:
        "Kroger API credentials are missing. Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET in .env.local.",
    };
  }

  try {
    const locationId =
      process.env.KROGER_LOCATION_ID?.trim() ??
      (await api.resolveLocationIdForZip(zipCode));

    if (!locationId) {
      return {
        configured: true,
        environment,
        baseUrl,
        tokenOk: true,
        catalogOk: false,
        pricingAvailable: false,
        message: `Kroger API auth succeeded, but no store locationId was returned near ZIP ${zipCode}.`,
      };
    }

    let products: KrogerProduct[];
    try {
      products = await searchProductsWithRetry(api, {
        term: "broccoli",
        locationId,
        limit: 1,
      });
    } catch (error: unknown) {
      return {
        configured: true,
        environment,
        baseUrl,
        tokenOk: true,
        locationId,
        catalogOk: false,
        pricingAvailable: false,
        message:
          error instanceof Error
            ? `Kroger API auth works for ${locationId}, but catalog search failed: ${error.message}`
            : `Kroger API auth works for ${locationId}, but catalog search failed.`,
      };
    }

    const firstProduct = products[0];
    const firstItem = firstProduct?.items?.[0];
    const searchPriceSummary = summarizeKrogerItemPrices(firstItem);
    const pricingAvailable = typeof searchPriceSummary.resolvedPrice === "number";
    const sampleProductDescription = firstProduct?.description?.trim();
    const productId = firstProduct?.productId?.trim();

    let detailPriceSummary: KrogerItemPriceSummary | undefined;
    let detailCatalogOk = false;
    if (productId) {
      const detailProduct = await api.getProduct(productId, locationId);
      detailCatalogOk = Boolean(detailProduct?.description?.trim());
      detailPriceSummary = summarizeKrogerItemPrices(detailProduct?.items?.[0]);
    }

    const anyPricingAvailable =
      pricingAvailable || typeof detailPriceSummary?.resolvedPrice === "number";
    const promotion = buildKrogerProductionPromotionStatus({
      environment,
      configured: true,
      tokenOk: true,
      locationId,
      catalogOk: Boolean(sampleProductDescription),
      pricingAvailable: anyPricingAvailable,
    });

    return {
      configured: true,
      environment,
      baseUrl,
      tokenOk: true,
      locationId,
      catalogOk: Boolean(sampleProductDescription),
      pricingAvailable: anyPricingAvailable,
      sampleProductDescription,
      productId,
      searchPriceSummary,
      detailPriceSummary,
      detailCatalogOk,
      productionPromotionReady: promotion.ready,
      productionPromotionSteps: promotion.steps,
      message: anyPricingAvailable
        ? `Kroger API is configured for ${environment} with location ${locationId} and store-specific pricing.`
        : environment === "certification"
          ? `Kroger API auth and catalog search work in certification (${locationId}), but store prices are not returned until the app is promoted to production. Search and product-detail probes both lacked item.price.regular/promo.`
          : `Kroger API auth works for ${locationId}, but the sample product search and detail lookup did not return store prices.`,
    };
  } catch (error: unknown) {
    return {
      configured: true,
      environment,
      baseUrl,
      tokenOk: false,
      catalogOk: false,
      pricingAvailable: false,
      message:
        error instanceof Error
          ? `Kroger API setup probe failed: ${error.message}`
          : "Kroger API setup probe failed.",
    };
  }
}

function summarizeKrogerItemPrices(
  item: Parameters<typeof readKrogerItemPrices>[0],
): KrogerItemPriceSummary {
  const { regularPrice, promoPrice, resolvedPrice, hasPromo } = readKrogerItemPrices(item);
  return {
    regularPrice,
    promoPrice,
    resolvedPrice,
    hasPromo,
  };
}

async function searchProductsWithRetry(
  api: KrogerApiClient,
  filters: KrogerProductSearchFilters,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await api.searchProducts(filters);
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof Error &&
        /status (429|502|503)/.test(error.message) &&
        attempt === 0;
      if (!retryable) {
        throw error;
      }
      await sleep(1_500);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Kroger product search failed after retries.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildKrogerProductionPromotionStatus(input: {
  environment: ReturnType<typeof getKrogerApiEnvironment>;
  configured: boolean;
  tokenOk: boolean;
  locationId?: string;
  catalogOk: boolean;
  pricingAvailable: boolean;
}) {
  const steps = [
    "Confirm the Kroger developer app has Locations + Products (`product.compact`) scopes in the Kroger developer portal.",
    "Verify certification auth, location lookup, and catalog search succeed (`npm run test:kroger-api`).",
    "Submit the app for production promotion in the Kroger developer portal and wait for approval.",
    "Set `KROGER_API_ENV=production` in `.env.local` after promotion is approved.",
    "Re-run `npm run test:kroger-api` and confirm search/detail probes return `item.price.regular` or `item.price.promo`.",
    "Keep weekly-ad / Flipp syndicated pricing labeled directional until production store prices are verified in store.",
  ];

  const ready =
    input.environment === "production" &&
    input.configured &&
    input.tokenOk &&
    Boolean(input.locationId) &&
    input.catalogOk &&
    input.pricingAvailable;

  return {
    ready,
    steps,
  };
}

export function createKrogerApiClient(input?: Partial<KrogerApiCredentials>) {
  const clientId = input?.clientId?.trim() ?? process.env.KROGER_CLIENT_ID?.trim();
  const clientSecret =
    input?.clientSecret?.trim() ?? process.env.KROGER_CLIENT_SECRET?.trim();

  return {
    isConfigured: Boolean(clientId && clientSecret),
    searchLocations: (filters: KrogerLocationSearchFilters) =>
      searchLocations({ clientId: clientId!, clientSecret: clientSecret! }, filters),
    getLocation: (locationId: string) =>
      getLocation({ clientId: clientId!, clientSecret: clientSecret! }, locationId),
    searchProducts: (filters: KrogerProductSearchFilters) =>
      searchProducts({ clientId: clientId!, clientSecret: clientSecret! }, filters),
    getProduct: (productId: string, locationId?: string) =>
      getProduct({ clientId: clientId!, clientSecret: clientSecret! }, productId, locationId),
    resolveLocationIdForZip: (zipCode: string, radiusMiles = 10) =>
      resolveLocationIdForZip(
        { clientId: clientId!, clientSecret: clientSecret! },
        zipCode,
        radiusMiles,
      ),
    warmProductsAccessToken: () => {
      if (!clientId || !clientSecret) {
        throw new Error("Kroger API credentials are missing.");
      }
      return getAccessToken(
        { clientId, clientSecret },
        KROGER_API_SPEC.scopes.products,
      );
    },
  };
}

export function readKrogerApiCredentialsFromEnv(): KrogerApiCredentials | undefined {
  const clientId = process.env.KROGER_CLIENT_ID?.trim();
  const clientSecret = process.env.KROGER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return undefined;
  }
  return { clientId, clientSecret };
}

async function searchLocations(
  credentials: KrogerApiCredentials,
  filters: KrogerLocationSearchFilters,
): Promise<KrogerLocation[]> {
  const accessToken = await getAccessToken(credentials);
  const url = buildLocationsUrl(filters);
  const payload = await krogerGet<KrogerLocationsResponse>(url, accessToken);
  return payload.data ?? [];
}

async function getLocation(
  credentials: KrogerApiCredentials,
  locationId: string,
): Promise<KrogerLocation | undefined> {
  const accessToken = await getAccessToken(credentials);
  const url = `${getKrogerApiBaseUrl()}${KROGER_API_SPEC.locationsPath}/${encodeURIComponent(locationId)}`;
  const payload = await krogerGet<{ data?: KrogerLocation }>(url, accessToken);
  return payload.data;
}

async function searchProducts(
  credentials: KrogerApiCredentials,
  filters: KrogerProductSearchFilters,
): Promise<KrogerProduct[]> {
  const accessToken = await getAccessToken(credentials, KROGER_API_SPEC.scopes.products);
  const url = buildProductsUrl(filters);
  const payload = await krogerGet<KrogerProductsResponse>(url, accessToken);
  return payload.data ?? [];
}

async function getProduct(
  credentials: KrogerApiCredentials,
  productId: string,
  locationId?: string,
): Promise<KrogerProduct | undefined> {
  const accessToken = await getAccessToken(credentials, KROGER_API_SPEC.scopes.products);
  const url = new URL(
    `${getKrogerApiBaseUrl()}${KROGER_API_SPEC.productsPath}/${encodeURIComponent(productId)}`,
  );
  if (locationId) {
    url.searchParams.set("filter.locationId", locationId);
  }
  const payload = await krogerGet<{ data?: KrogerProduct }>(url.toString(), accessToken);
  return payload.data;
}

async function resolveLocationIdForZip(
  credentials: KrogerApiCredentials,
  zipCode: string,
  radiusMiles: number,
) {
  const locations = await searchLocations(credentials, {
    zipCodeNear: zipCode,
    radiusInMiles: radiusMiles,
    limit: 1,
    chain: "Kroger",
  });

  return locations[0]?.locationId;
}

function buildLocationsUrl(filters: KrogerLocationSearchFilters) {
  const url = new URL(`${getKrogerApiBaseUrl()}${KROGER_API_SPEC.locationsPath}`);

  if (filters.zipCodeNear) {
    url.searchParams.set("filter.zipCode.near", filters.zipCodeNear);
  }
  if (filters.latLongNear) {
    url.searchParams.set("filter.latLong.near", filters.latLongNear);
  }
  if (filters.latNear) {
    url.searchParams.set("filter.lat.near", filters.latNear);
  }
  if (filters.lonNear) {
    url.searchParams.set("filter.lon.near", filters.lonNear);
  }
  if (filters.radiusInMiles !== undefined) {
    url.searchParams.set("filter.radiusInMiles", String(filters.radiusInMiles));
  }
  if (filters.limit !== undefined) {
    url.searchParams.set("filter.limit", String(filters.limit));
  }
  if (filters.chain) {
    url.searchParams.set("filter.chain", filters.chain);
  }
  if (filters.locationId) {
    url.searchParams.set("filter.locationId", filters.locationId);
  }

  return url.toString();
}

function buildProductsUrl(filters: KrogerProductSearchFilters) {
  const url = new URL(`${getKrogerApiBaseUrl()}${KROGER_API_SPEC.productsPath}`);

  if (filters.term) {
    url.searchParams.set("filter.term", filters.term);
  }
  if (filters.brand) {
    url.searchParams.set("filter.brand", filters.brand);
  }
  if (filters.productId) {
    url.searchParams.set("filter.productId", filters.productId);
  }
  if (filters.locationId) {
    url.searchParams.set("filter.locationId", filters.locationId);
  }
  if (filters.fulfillment) {
    url.searchParams.set("filter.fulfillment", filters.fulfillment);
  }
  if (filters.start !== undefined) {
    url.searchParams.set("filter.start", String(filters.start));
  }
  if (filters.limit !== undefined) {
    url.searchParams.set("filter.limit", String(filters.limit));
  }

  return url.toString();
}

async function getAccessToken(
  credentials: KrogerApiCredentials,
  scope?: string,
) {
  const cacheKey = buildKrogerTokenCacheKey(credentials, scope);
  const cached = krogerAccessTokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    return cached.accessToken;
  }

  const inFlight = krogerAccessTokenInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = requestKrogerAccessToken(credentials, scope, cacheKey);
  krogerAccessTokenInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    krogerAccessTokenInFlight.delete(cacheKey);
  }
}

function buildKrogerTokenCacheKey(credentials: KrogerApiCredentials, scope?: string) {
  return `${credentials.clientId}:${scope ?? ""}`;
}

async function requestKrogerAccessToken(
  credentials: KrogerApiCredentials,
  scope: string | undefined,
  cacheKey: string,
) {
  const auth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`,
  ).toString("base64");
  const body = scope
    ? `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
    : "grant_type=client_credentials";

  const response = await fetch(`${getKrogerApiBaseUrl()}${KROGER_API_SPEC.tokenPath}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Kroger token request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) {
    throw new Error("Kroger token response did not include an access token");
  }

  const ttlMs =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in * 1000
      : DEFAULT_TOKEN_TTL_MS;
  krogerAccessTokenCache.set(cacheKey, {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + ttlMs - TOKEN_EXPIRY_BUFFER_MS,
  });

  return payload.access_token;
}

async function krogerGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Kroger API request failed with status ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}
