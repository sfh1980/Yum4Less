import type { MockPriceObservation } from "@/lib/mock-market-data";
import { getPricingCoverageStatus } from "@/lib/providers/provider-price-matching";
import type { ProviderPricingCoverageStatus } from "@/lib/providers/provider-types";
import type { StoreChain } from "@/lib/provider-rollout";
import { getWeeklyAdSourceName } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const MIN_WEEKLY_AD_PROMOTION_MATCHES = 3;
export const MIN_WEEKLY_AD_PROMOTION_CONFIDENCE = 0.45;
export const MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS = 14;

export const WEEKLY_AD_RANKED_PRICING_CHAINS = new Set<WeeklyAdChain>([
  "kroger",
  "publix",
  "walmart",
]);

export type WeeklyAdStoreCoverage = {
  storeId: string;
  chain: StoreChain;
  matchedIngredientCount: number;
  totalRecipeIngredientCount: number;
  averageMatchConfidence: number | null;
  maxFreshnessDaysAgo: number | null;
  coverageStatus: ProviderPricingCoverageStatus;
  usesWeeklyAdSource: boolean;
};

export function buildWeeklyAdStoreCoverage(input: {
  storeId: string;
  chain: StoreChain;
  priceObservations: MockPriceObservation[];
  recipeIngredientIds: string[];
}): WeeklyAdStoreCoverage {
  const weeklyAdSource = getWeeklyAdSourceNameForChain(input.chain);
  const weeklyAdObservations = input.priceObservations.filter(
    (observation) =>
      observation.storeId === input.storeId &&
      observation.priceSource === weeklyAdSource &&
      observation.inStock &&
      observation.ingredientId !== undefined,
  );

  const matchedIngredientIds = new Set(
    weeklyAdObservations
      .map((observation) => observation.ingredientId)
      .filter(
        (ingredientId): ingredientId is string =>
          Boolean(ingredientId) &&
          input.recipeIngredientIds.includes(ingredientId),
      ),
  );

  const confidences = weeklyAdObservations
    .filter((observation) =>
      matchedIngredientIds.has(observation.ingredientId ?? ""),
    )
    .map((observation) => observation.matchConfidence ?? 0);

  const maxFreshnessDaysAgo =
    weeklyAdObservations.length > 0
      ? Math.max(...weeklyAdObservations.map((o) => o.freshnessDaysAgo))
      : null;

  const matchedIngredientCount = matchedIngredientIds.size;
  const totalRecipeIngredientCount = input.recipeIngredientIds.length;

  return {
    storeId: input.storeId,
    chain: input.chain,
    matchedIngredientCount,
    totalRecipeIngredientCount,
    averageMatchConfidence: average(confidences),
    maxFreshnessDaysAgo,
    coverageStatus: getPricingCoverageStatus({
      matchedIngredientCount,
      totalTrackedIngredients: Math.max(totalRecipeIngredientCount, 1),
    }),
    usesWeeklyAdSource: weeklyAdObservations.length > 0,
  };
}

export function weeklyAdPromotionGatesPass(
  coverage: WeeklyAdStoreCoverage,
  chain: StoreChain,
): boolean {
  if (chain === "walmart") {
    return false;
  }

  if (!WEEKLY_AD_RANKED_PRICING_CHAINS.has(chain as WeeklyAdChain)) {
    return false;
  }

  if (!coverage.usesWeeklyAdSource || coverage.matchedIngredientCount === 0) {
    return false;
  }

  if (coverage.matchedIngredientCount < MIN_WEEKLY_AD_PROMOTION_MATCHES) {
    return false;
  }

  if (
    coverage.averageMatchConfidence === null ||
    coverage.averageMatchConfidence < MIN_WEEKLY_AD_PROMOTION_CONFIDENCE
  ) {
    return false;
  }

  if (
    coverage.maxFreshnessDaysAgo !== null &&
    coverage.maxFreshnessDaysAgo > MAX_WEEKLY_AD_PROMOTION_FRESHNESS_DAYS
  ) {
    return false;
  }

  return coverage.coverageStatus !== "none";
}

function getWeeklyAdSourceNameForChain(chain: StoreChain): string | undefined {
  if (!WEEKLY_AD_RANKED_PRICING_CHAINS.has(chain as WeeklyAdChain)) {
    return `${chain}-weekly-ad-scrape`;
  }

  return getWeeklyAdSourceName(chain as WeeklyAdChain);
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
