/** Sample/bootstrap pricing rows — never used for ranked meal pricing. */
export const SAMPLE_PRICE_SOURCE = "mock-market-data";

/** Curated catalog entities (stores, ingredients, recipes) — not pricing. */
export const INTERNAL_CATALOG_SOURCE = "yum4less-internal-catalog";

export const KROGER_OFFICIAL_PRICE_SOURCE = "kroger-official-api";
export const WALMART_ONLINE_PRICE_SOURCE = "walmart-online-api";
export const PUBLIX_ONLINE_PRICE_SOURCE = "publix-online-api";

export type RankedPriceSourceKind =
  | "official-online"
  | "weekly-ad"
  | "sample"
  | "unknown";

export type RankedPricingSource =
  | "weekly-ad-cache"
  | "official-api-cache"
  | "online-cache"
  | "mixed-online-weekly-ad-cache"
  | "none"
  | "limited-coverage";

export const OFFICIAL_ONLINE_PRICE_SOURCES = [
  KROGER_OFFICIAL_PRICE_SOURCE,
  WALMART_ONLINE_PRICE_SOURCE,
  PUBLIX_ONLINE_PRICE_SOURCE,
] as const;

export function isSamplePriceSource(sourceName: string | undefined): boolean {
  return sourceName === SAMPLE_PRICE_SOURCE;
}

export function getRankedPriceSourceKind(
  sourceName: string | undefined,
): RankedPriceSourceKind {
  if (!sourceName) {
    return "unknown";
  }
  if (isSamplePriceSource(sourceName)) {
    return "sample";
  }
  if ((OFFICIAL_ONLINE_PRICE_SOURCES as readonly string[]).includes(sourceName)) {
    return "official-online";
  }
  if (sourceName.endsWith("-weekly-ad-scrape")) {
    return "weekly-ad";
  }
  return "unknown";
}

export function getRankedPriceSourceTier(sourceName: string | undefined) {
  switch (getRankedPriceSourceKind(sourceName)) {
    case "official-online":
      return 1;
    case "weekly-ad":
      return 2;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

export function isLiveRankedPriceSource(sourceName: string | undefined): boolean {
  return getRankedPriceSourceTier(sourceName) !== Number.POSITIVE_INFINITY;
}

export const RANKED_PRICE_SOURCE_SQL_FILTER = [
  ...OFFICIAL_ONLINE_PRICE_SOURCES.map((source) => `source_name = '${source}'`),
  "source_name like '%-weekly-ad-scrape'",
].join(" or ");

/** SQL expression where lower values are preferred for ranked reads. */
export const RANKED_PRICE_SOURCE_TIER_SQL = `
  case
    when source_name in (${OFFICIAL_ONLINE_PRICE_SOURCES.map((source) => `'${source}'`).join(", ")}) then 1
    when source_name like '%-weekly-ad-scrape' then 2
    else 99
  end
`;

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
    getRankedPriceSourceKind(source) === "weekly-ad",
  );
  const hasOfficial = liveSources.some(
    (source) => getRankedPriceSourceKind(source) === "official-online",
  );

  if (input.recommendationEnabledStoreCount === 0 && liveSources.length > 0) {
    return "limited-coverage";
  }

  if (hasWeeklyAd && hasOfficial) {
    return "mixed-online-weekly-ad-cache";
  }
  if (hasOfficial) {
    return "online-cache";
  }
  if (hasWeeklyAd) {
    return "weekly-ad-cache";
  }

  return "limited-coverage";
}
