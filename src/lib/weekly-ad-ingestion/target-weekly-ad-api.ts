/**
 * Target embeds a public web API key in target.com (not a Yum4Less secret).
 * Override with TARGET_API_KEY when Target rotates the guest key.
 */
export const TARGET_PUBLIC_WEB_API_KEY_DEFAULT =
  "9ba599525edd204c560a2182ae1cbfaa3eeddca5";

export const TARGET_WEEKLY_AD_PAGE_URL = "https://www.target.com/weekly-ad";
export const TARGET_NEARBY_STORES_URL =
  "https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1";
export const TARGET_STORE_PROMOTIONS_URL =
  "https://api.target.com/weekly_ads/v1/store_promotions";
export const TARGET_PROMOTION_DETAIL_URL_PREFIX =
  "https://api.target.com/weekly_ads/v1/promotions";

export function resolveTargetApiKey(): string {
  const fromEnv = process.env.TARGET_API_KEY?.trim();
  return fromEnv || TARGET_PUBLIC_WEB_API_KEY_DEFAULT;
}

export function buildTargetApiHeaders(): HeadersInit {
  return {
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    origin: "https://www.target.com",
    referer: "https://www.target.com/",
  };
}
