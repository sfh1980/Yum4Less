import {
  FIXTURE_CHAIN_MEMBERSHIP,
  isShopperRankedChain,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";
import { getWeeklyAdSourceName } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import { isWeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";
import type { StoreChain } from "@/lib/provider-rollout";
import { getPricingCoverageStatus } from "@/lib/providers/provider-price-matching";
import type { ProviderPricingCoverageStatus } from "@/lib/providers/provider-types";
import { RANKED_PRICE_CACHE_TTL_HOURS } from "@/lib/ranked-price-cache-policy";
import type { CatalogPriceObservation } from "@/lib/market-catalog-types";

export const MIN_WEEKLY_AD_PROMOTION_MATCHES = 3;
export const MIN_WEEKLY_AD_PROMOTION_CONFIDENCE = 0.45;

/** Same window as ranked price reads — do not define a separate freshness TTL here. */
export const WEEKLY_AD_PROMOTION_FRESHNESS_HOURS = RANKED_PRICE_CACHE_TTL_HOURS;

export { WEEKLY_AD_RANKED_PRICING_CHAINS } from "@/lib/chain-rollout-policy";

export type WeeklyAdStoreCoverage = {
  storeId: string;
  chain: StoreChain;
  matchedIngredientCount: number;
  totalRecipeIngredientCount: number;
  averageMatchConfidence: number | null;
  maxFreshnessHoursAgo: number | null;
  maxFreshnessDaysAgo: number | null;
  coverageStatus: ProviderPricingCoverageStatus;
  usesWeeklyAdSource: boolean;
};

export function isFreshWeeklyAdObservation(
  observation: CatalogPriceObservation,
): boolean {
  if (observation.freshnessHoursAgo !== undefined) {
    return observation.freshnessHoursAgo < WEEKLY_AD_PROMOTION_FRESHNESS_HOURS;
  }

  return observation.freshnessDaysAgo * 24 < WEEKLY_AD_PROMOTION_FRESHNESS_HOURS;
}

export function buildWeeklyAdStoreCoverage(input: {
  storeId: string;
  chain: StoreChain;
  priceObservations: CatalogPriceObservation[];
  recipeIngredientIds: string[];
  /**
   * When set (market-search identity expand ON), obs on any equivalent
   * member store_id count toward this store's coverage. Omit → exact id.
   */
  equivalentStoreIds?: ReadonlySet<string>;
}): WeeklyAdStoreCoverage {
  const weeklyAdSource = getWeeklyAdSourceNameForChain(input.chain);
  const storeIds =
    input.equivalentStoreIds ?? new Set([input.storeId]);
  const weeklyAdObservations = input.priceObservations.filter(
    (observation) =>
      storeIds.has(observation.storeId) &&
      observation.priceSource === weeklyAdSource &&
      observation.inStock &&
      observation.ingredientId !== undefined &&
      isFreshWeeklyAdObservation(observation),
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

  const freshnessHours = weeklyAdObservations.map(
    (observation) =>
      observation.freshnessHoursAgo ?? observation.freshnessDaysAgo * 24,
  );
  const maxFreshnessHoursAgo =
    freshnessHours.length > 0 ? Math.max(...freshnessHours) : null;
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
    maxFreshnessHoursAgo,
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
  membership: ChainMembershipSnapshot = FIXTURE_CHAIN_MEMBERSHIP,
): boolean {
  if (!isShopperRankedChain(membership, chain)) {
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
    coverage.maxFreshnessHoursAgo !== null &&
    coverage.maxFreshnessHoursAgo >= WEEKLY_AD_PROMOTION_FRESHNESS_HOURS
  ) {
    return false;
  }

  return coverage.coverageStatus !== "none";
}

function getWeeklyAdSourceNameForChain(chain: StoreChain): string | undefined {
  if (!isWeeklyAdChain(chain)) {
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
