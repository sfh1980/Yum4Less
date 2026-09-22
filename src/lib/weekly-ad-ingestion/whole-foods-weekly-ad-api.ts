/**
 * Whole Foods public site URLs. Store numbers are resolved at runtime from
 * ZIP/coordinates — never hardcode a store id in adapters.
 */
export const WHOLE_FOODS_ORIGIN = "https://www.wholefoodsmarket.com";
export const WHOLE_FOODS_STORES_URL = `${WHOLE_FOODS_ORIGIN}/stores`;
export const WHOLE_FOODS_SALES_FLYER_PATH = "/sales-flyer";
export const WHOLE_FOODS_CLOSEST_STORE_PATH =
  "/api/wwos/location/store/closest";
export const WHOLE_FOODS_STORE_SUMMARY_PATH_PREFIX = "/api/stores";

export function buildWholeFoodsSalesFlyerUrl(storeId: string): string {
  const url = new URL(WHOLE_FOODS_SALES_FLYER_PATH, WHOLE_FOODS_ORIGIN);
  url.searchParams.set("store-id", storeId);
  return url.toString();
}

export function buildWholeFoodsStoreSummaryUrl(storeId: string): string {
  return `${WHOLE_FOODS_ORIGIN}${WHOLE_FOODS_STORE_SUMMARY_PATH_PREFIX}/${encodeURIComponent(storeId)}/summary`;
}

export function buildWholeFoodsBrowserHeaders(): HeadersInit {
  return {
    accept: "application/json,text/html;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    origin: WHOLE_FOODS_ORIGIN,
    referer: `${WHOLE_FOODS_ORIGIN}/`,
  };
}
