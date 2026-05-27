/**
 * Constants and types derived from Kroger OpenAPI specs:
 * - spec/openapi-products.json (Products API v1.3.0)
 * - spec/openapi-locations.json (Location API v1.2.3)
 */

export const KROGER_API_SPEC = {
  productsVersion: "1.3.0",
  locationsVersion: "1.2.3",
  productionBaseUrl: "https://api.kroger.com",
  certificationBaseUrl: "https://api-ce.kroger.com",
  tokenPath: "/v1/connect/oauth2/token",
  productsPath: "/v1/products",
  locationsPath: "/v1/locations",
  rateLimits: {
    productsCallsPerDay: 10_000,
    locationsCallsPerEndpointPerDay: 1_600,
  },
  scopes: {
    products: "product.compact",
  },
} as const;

export type KrogerApiEnvironment = "certification" | "production";

export function getKrogerApiEnvironment(): KrogerApiEnvironment {
  const configured = process.env.KROGER_API_ENV?.trim().toLowerCase();
  if (configured === "production" || configured === "prod") {
    return "production";
  }
  return "certification";
}

export function getKrogerApiBaseUrl() {
  return getKrogerApiEnvironment() === "production"
    ? KROGER_API_SPEC.productionBaseUrl
    : KROGER_API_SPEC.certificationBaseUrl;
}

export type KrogerProductFulfillmentFilter = "ais" | "csp" | "dth" | "sth";

export type KrogerStockLevel = "HIGH" | "LOW" | "TEMPORARILY_OUT_OF_STOCK";

export type KrogerProductItemPrice = {
  regular?: number;
  promo?: number;
  regularPerUnitEstimate?: number;
  promoPerUnitEstimate?: number;
};

export type KrogerProductItemFulfillment = {
  instore?: boolean;
  inStore?: boolean;
  curbside?: boolean;
  delivery?: boolean;
  shiptohome?: boolean;
  shipToHome?: boolean;
};

export type KrogerProductItem = {
  itemId?: string;
  price?: KrogerProductItemPrice;
  nationalPrice?: KrogerProductItemPrice;
  fulfillment?: KrogerProductItemFulfillment;
  inventory?: {
    stockLevel?: KrogerStockLevel;
  };
  size?: string;
};

export type KrogerProduct = {
  productId?: string;
  upc?: string;
  description?: string;
  brand?: string;
  items?: KrogerProductItem[];
};

export type KrogerProductsResponse = {
  data?: KrogerProduct[];
  meta?: {
    pagination?: {
      total?: number;
      start?: number;
      limit?: number;
    };
  };
};

export type KrogerLocationAddress = {
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
};

export type KrogerLocation = {
  locationId?: string;
  name?: string;
  chain?: string;
  address?: KrogerLocationAddress;
  geolocation?: {
    latitude?: number;
    longitude?: number;
  };
};

export type KrogerLocationsResponse = {
  data?: KrogerLocation[];
  meta?: {
    pagination?: {
      total?: number;
      start?: number;
      limit?: number;
    };
  };
};

export type KrogerLocationSearchFilters = {
  zipCodeNear?: string;
  latLongNear?: string;
  latNear?: string;
  lonNear?: string;
  radiusInMiles?: number;
  limit?: number;
  chain?: string;
  locationId?: string;
};

export type KrogerProductSearchFilters = {
  term?: string;
  brand?: string;
  productId?: string;
  locationId?: string;
  fulfillment?: KrogerProductFulfillmentFilter | `${KrogerProductFulfillmentFilter},${string}`;
  start?: number;
  limit?: number;
};

export function isKrogerProductAvailableInStore(item: KrogerProductItem | undefined) {
  return item?.fulfillment?.instore === true || item?.fulfillment?.inStore === true;
}

export function readKrogerItemPrices(item: KrogerProductItem | undefined) {
  const regularPrice = item?.price?.regular;
  const promoPrice = item?.price?.promo;
  const resolvedPrice =
    typeof promoPrice === "number"
      ? promoPrice
      : typeof regularPrice === "number"
        ? regularPrice
        : undefined;

  return {
    regularPrice: typeof regularPrice === "number" ? regularPrice : undefined,
    promoPrice: typeof promoPrice === "number" ? promoPrice : undefined,
    resolvedPrice,
    hasPromo:
      typeof promoPrice === "number" &&
      typeof regularPrice === "number" &&
      promoPrice < regularPrice,
  };
}
