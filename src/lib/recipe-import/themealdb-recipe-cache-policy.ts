import { RANKED_PRICE_CACHE_TTL_HOURS } from "@/lib/ranked-price-cache-policy";

/** TheMealDB recipe imports share the same 24-hour discipline as ranked price reads. */
export const THEMEALDB_RECIPE_CACHE_TTL_HOURS = RANKED_PRICE_CACHE_TTL_HOURS;

export const THEMEALDB_ATTRIBUTION_URL = "https://www.themealdb.com";
export const THEMEALDB_TERMS_URL = "https://www.themealdb.com/terms_of_use.php";

/** Smaller cap on user-triggered search refresh than cron/script ingest. */
export const DEFAULT_THEMEALDB_SEARCH_IMPORT_MAX_PER_RUN = 5;

/**
 * Bounded TheMealDB import on /api/recommendations is allowed in non-production by default.
 * Production should rely on scheduled ingest unless explicitly opted in.
 */
export function isThemealdbSearchImportEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT === "1";
  }

  return process.env.YUM4LESS_ENABLE_THEMEALDB_SEARCH_IMPORT !== "0";
}

export function isThemealdbRecipeCacheFresh(latestImportAt: Date | null): boolean {
  if (!latestImportAt) {
    return false;
  }

  const ageMs = Date.now() - latestImportAt.getTime();
  return ageMs <= THEMEALDB_RECIPE_CACHE_TTL_HOURS * 3_600_000;
}

export function buildThemealdbMealUrl(sourceRecipeId: string): string {
  return `${THEMEALDB_ATTRIBUTION_URL}/meal/${encodeURIComponent(sourceRecipeId)}`;
}
