/** Sample/bootstrap pricing rows — never used for ranked meal pricing. */
export const SAMPLE_PRICE_SOURCE = "mock-market-data";

/** Curated catalog entities (stores, ingredients, recipes) — not pricing. */
export const INTERNAL_CATALOG_SOURCE = "yum4less-internal-catalog";

export const KROGER_OFFICIAL_PRICE_SOURCE = "kroger-official-api";

export type RankedPricingSource =
  | "weekly-ad-cache"
  | "official-api-cache"
  | "mixed-live-cache"
  | "none"
  | "limited-coverage";

export function isSamplePriceSource(sourceName: string | undefined): boolean {
  return sourceName === SAMPLE_PRICE_SOURCE;
}

export function isLiveRankedPriceSource(sourceName: string | undefined): boolean {
  if (!sourceName || isSamplePriceSource(sourceName)) {
    return false;
  }

  return (
    sourceName.endsWith("-weekly-ad-scrape") ||
    sourceName === KROGER_OFFICIAL_PRICE_SOURCE
  );
}

/** SQL fragment excluding sample pricing rows from ranked reads. */
export const LIVE_PRICE_SQL_FILTER = `source_name is distinct from '${SAMPLE_PRICE_SOURCE}'`;

export function deriveRankedPricingSource(input: {
  priceSources: Array<string | undefined>;
  recommendationEnabledStoreCount: number;
}): RankedPricingSource {
  const liveSources = input.priceSources.filter((source) =>
    isLiveRankedPriceSource(source),
  );

  if (liveSources.length === 0) {
    return "none";
  }

  const hasWeeklyAd = liveSources.some((source) =>
    source?.endsWith("-weekly-ad-scrape"),
  );
  const hasOfficial = liveSources.some(
    (source) => source === KROGER_OFFICIAL_PRICE_SOURCE,
  );

  if (input.recommendationEnabledStoreCount === 0 && liveSources.length > 0) {
    return "limited-coverage";
  }

  if (hasWeeklyAd && hasOfficial) {
    return "mixed-live-cache";
  }
  if (hasOfficial) {
    return "official-api-cache";
  }
  if (hasWeeklyAd) {
    return "weekly-ad-cache";
  }

  return "limited-coverage";
}
