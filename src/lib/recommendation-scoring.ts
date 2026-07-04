import type { CatalogPriceObservation } from "@/lib/market-catalog-types";
import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import { getRankedPriceSourceTier } from "@/lib/price-source-policy";
import type {
  MealPreferenceForm,
  ScoreBreakdown,
  ShoppingPlanItem,
} from "@/lib/recommendation-types";

export function scoreCandidate({
  recipe,
  shoppingPlan,
  preferences,
  estimatedTotal,
}: {
  recipe: CatalogRecipeRecord;
  shoppingPlan: ShoppingPlanItem[];
  preferences: MealPreferenceForm;
  estimatedTotal: number;
}): ScoreBreakdown {
  const storeCount = new Set(shoppingPlan.map((item) => item.storeName)).size;
  const averageFreshnessHours =
    shoppingPlan.reduce(
      (sum, item) => sum + (item.freshnessHoursAgo ?? item.freshnessDaysAgo * 24),
      0,
    ) / shoppingPlan.length;
  const averageSourceTier =
    shoppingPlan.reduce(
      (sum, item) => sum + (item.priceSourceTier ?? getRankedPriceSourceTier(item.priceSource)),
      0,
    ) / shoppingPlan.length;
  const weakMatchPenalty = shoppingPlan.some(
    (item) => item.matchConfidence !== undefined && item.matchConfidence < 0.7,
  )
    ? 3
    : 0;
  const dietaryBoost =
    preferences.dietaryFocus !== "anything" &&
    recipe.dietaryTags.includes(preferences.dietaryFocus)
      ? 4
      : 0;

  const price = clamp(
    Math.round(((preferences.budget - estimatedTotal) / preferences.budget) * 40 + 18),
    0,
    40,
  );
  const convenience = clamp(
    30 - (storeCount - 1) * 10 - Math.max(0, recipe.cookTimeMinutes - 25),
    0,
    30,
  );
  const freshness = clamp(
    Math.round(
      20 -
        Math.min(averageFreshnessHours / 6, 12) -
        Math.max(0, averageSourceTier - 1) * 3 -
        weakMatchPenalty,
    ),
    4,
    20,
  );
  const fit = clamp(
    10 + (preferences.maxIngredients - recipe.ingredients.length) * 2 + dietaryBoost,
    0,
    20,
  );

  return {
    total: price + convenience + freshness + fit,
    price,
    convenience,
    freshness,
    fit,
  };
}

export function comparePlanQuality(left: ShoppingPlanItem[], right: ShoppingPlanItem[]) {
  const leftQuality = getPlanQuality(left);
  const rightQuality = getPlanQuality(right);

  return (
    leftQuality.averageTier - rightQuality.averageTier ||
    leftQuality.averageFreshnessHours - rightQuality.averageFreshnessHours ||
    rightQuality.averageConfidence - leftQuality.averageConfidence ||
    leftQuality.total - rightQuality.total
  );
}

export function getPlanQuality(plan: ShoppingPlanItem[]) {
  return {
    averageTier:
      plan.reduce((sum, item) => sum + (item.priceSourceTier ?? 99), 0) /
      plan.length,
    averageFreshnessHours:
      plan.reduce(
        (sum, item) => sum + (item.freshnessHoursAgo ?? item.freshnessDaysAgo * 24),
        0,
      ) / plan.length,
    averageConfidence:
      plan.reduce((sum, item) => sum + (item.matchConfidence ?? 0.7), 0) /
      plan.length,
    total: plan.reduce((sum, item) => sum + item.price, 0),
  };
}

export function compareObservationQuality(
  left: CatalogPriceObservation,
  right: CatalogPriceObservation,
) {
  const leftTier = left.priceSourceTier ?? getRankedPriceSourceTier(left.priceSource);
  const rightTier = right.priceSourceTier ?? getRankedPriceSourceTier(right.priceSource);
  const leftFreshness = left.freshnessHoursAgo ?? left.freshnessDaysAgo * 24;
  const rightFreshness = right.freshnessHoursAgo ?? right.freshnessDaysAgo * 24;
  const leftConfidence = left.matchConfidence ?? 0.7;
  const rightConfidence = right.matchConfidence ?? 0.7;

  return (
    leftTier - rightTier ||
    leftFreshness - rightFreshness ||
    rightConfidence - leftConfidence ||
    left.price - right.price
  );
}

export function getFreshnessLabel(shoppingPlan: ShoppingPlanItem[]) {
  const averageHours =
    shoppingPlan.reduce(
      (sum, item) => sum + (item.freshnessHoursAgo ?? item.freshnessDaysAgo * 24),
      0,
    ) / shoppingPlan.length;
  const averageDays =
    shoppingPlan.reduce((sum, item) => sum + item.freshnessDaysAgo, 0) /
    shoppingPlan.length;

  const hasOnline = shoppingPlan.some(
    (item) => item.priceSourceKind === "official-online",
  );

  if (hasOnline && averageHours <= 1) {
    return "Checked within 1 hour";
  }
  if (hasOnline && averageHours <= 24) {
    return "Same-day online prices";
  }
  if (averageDays <= 3.5) {
    return "Recent sale prices";
  }
  return "Older prices — verify in store";
}

export function getConfidenceLabel(shoppingPlan: ShoppingPlanItem[]) {
  const storeCount = new Set(shoppingPlan.map((item) => item.storeName)).size;
  if (storeCount === 1) {
    return "Single-store estimate";
  }
  return "Multi-store estimate";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
