import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import { KROGER_OFFICIAL_PRICE_SOURCE } from "@/lib/price-source-policy";

export const MIN_KROGER_OFFICIAL_API_PROMOTION_MATCHES = 3;
export const KROGER_OFFICIAL_API_FRESHNESS_HOURS = 24;

export type KrogerOfficialApiStoreCoverage = {
  storeId: string;
  freshMatchedIngredientCount: number;
  usesOfficialApiSource: boolean;
};

export function buildKrogerOfficialApiStoreCoverage(input: {
  storeId: string;
  priceObservations: CatalogPriceObservation[];
  /**
   * When set (market-search identity expand ON), obs on any equivalent
   * member store_id count toward this store's coverage. Omit → exact id.
   */
  equivalentStoreIds?: ReadonlySet<string>;
}): KrogerOfficialApiStoreCoverage {
  const storeIds =
    input.equivalentStoreIds ?? new Set([input.storeId]);
  const officialObservations = input.priceObservations.filter(
    (observation) =>
      storeIds.has(observation.storeId) &&
      observation.priceSource === KROGER_OFFICIAL_PRICE_SOURCE &&
      observation.inStock &&
      observation.ingredientId !== undefined &&
      isFreshOfficialApiObservation(observation),
  );

  const matchedIngredientIds = new Set(
    officialObservations.map((observation) => observation.ingredientId),
  );

  return {
    storeId: input.storeId,
    freshMatchedIngredientCount: matchedIngredientIds.size,
    usesOfficialApiSource: officialObservations.length > 0,
  };
}

export function krogerOfficialApiPromotionGatesPass(
  coverage: Pick<KrogerOfficialApiStoreCoverage, "freshMatchedIngredientCount">,
): boolean {
  return (
    coverage.freshMatchedIngredientCount >= MIN_KROGER_OFFICIAL_API_PROMOTION_MATCHES
  );
}

function isFreshOfficialApiObservation(observation: CatalogPriceObservation) {
  if (observation.freshnessHoursAgo !== undefined) {
    return observation.freshnessHoursAgo < KROGER_OFFICIAL_API_FRESHNESS_HOURS;
  }

  return observation.freshnessDaysAgo * 24 < KROGER_OFFICIAL_API_FRESHNESS_HOURS;
}
