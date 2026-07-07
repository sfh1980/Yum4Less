import type { CatalogRecipeRecord } from "@/lib/market-catalog-types";
import type { MarketDataSource } from "@/lib/market-repository";
import { getSaleConfidence } from "@/lib/sale-confidence";
import {
  buildRecipeProviderPreviewComparisons,
} from "@/lib/seed-vs-provider-recipe-comparison";
import type { ProviderPricingPreviewResult } from "@/lib/providers/provider-types";
import { buildThemealdbAttribution } from "@/lib/recipe-import/recipe-ranking-eligibility";
import type {
  MealPreferenceForm,
  MealRecommendation,
  NearbyStoreSummary,
  RecommendationCandidate,
  ShopperNotice,
  StorePlan,
} from "@/lib/recommendation-types";

export function attachMealPresentation(
  candidate: RecommendationCandidate,
  providerPricingPreviews: ProviderPricingPreviewResult[],
  dataSource: MarketDataSource,
  nearbyStores: NearbyStoreSummary[],
): MealRecommendation {
  const recommendation = toRecommendation(candidate, dataSource, nearbyStores);

  return {
    ...recommendation,
    providerPreviewComparisons: buildRecipeProviderPreviewComparisons({
      recipe: candidate.recipe,
      seedEstimatedTotal: candidate.estimatedTotal,
      shoppingPlan: recommendation.shoppingPlan
        .filter((item) => !item.sourcedFromPantry && item.storeName)
        .map((item) => ({
          ingredient: item.ingredient,
          quantityNote: item.quantityNote,
          storeName: item.storeName!,
          price: item.price,
          freshnessDaysAgo: item.freshnessDaysAgo ?? 0,
          saleLabel: item.saleLabel,
        })),
      providerPricingPreviews,
    }),
  };
}

export function toRecommendation(
  candidate: RecommendationCandidate,
  dataSource: MarketDataSource,
  nearbyStores: NearbyStoreSummary[],
): Omit<MealRecommendation, "providerPreviewComparisons"> {
  // TODO: add storeId to ShoppingPlanItem and StorePlan so overlay join
  // uses ID rather than name — avoids ambiguity when two same-chain
  // branches are in radius. See 2026-06-30 store-map-overlay session.
  const storePlan = Array.from(
    candidate.shoppingPlan
      .filter((item) => !item.sourcedFromPantry && item.storeName)
      .reduce((map, item) => {
        const storeName = item.storeName!;
        const entry = map.get(storeName) ?? {
          storeName,
          subtotal: 0,
          itemCount: 0,
        };
        entry.subtotal += item.price;
        entry.itemCount += 1;
        map.set(storeName, entry);
        return map;
      }, new Map<string, StorePlan>()),
  )
    .map(([, plan]) => ({
      ...plan,
      subtotal: roundCurrency(plan.subtotal),
    }))
    .sort((left, right) => right.subtotal - left.subtotal);

  return {
    title: candidate.recipe.title,
    summary: candidate.recipe.summary,
    estimatedTotal: candidate.estimatedTotal,
    storeCount: storePlan.length,
    matchedIngredients: candidate.shoppingPlan.length,
    cookTimeMinutes: candidate.recipe.cookTimeMinutes,
    difficulty: candidate.recipe.difficulty,
    primaryStore: storePlan[0]?.storeName ?? "Unknown store",
    ingredientHighlights: candidate.recipe.ingredients
      .slice(0, 3)
      .map((ingredient) => ingredient.displayName.toLowerCase()),
    instructions: candidate.recipe.steps,
    shoppingPlan: candidate.shoppingPlan.map((item) => ({
      ...item,
      ...(item.sourcedFromPantry
        ? {}
        : {
            saleConfidence: getSaleConfidence({
              saleLabel: item.saleLabel,
              freshnessDaysAgo: item.freshnessDaysAgo ?? 0,
              freshnessHoursAgo: item.freshnessHoursAgo,
              dataSource,
              priceSource: item.priceSource,
              matchConfidence: item.matchConfidence,
            }),
          }),
    })),
    storePlan,
    score: candidate.score,
    confidenceLabel: candidate.confidenceLabel,
    tags: candidate.recipe.tags,
    freshnessLabel: candidate.freshnessLabel,
    explanation: buildExplanation(candidate, storePlan.length),
    ...buildThemealdbRecommendationAttribution(candidate.recipe, nearbyStores),
  };
}

export function buildThemealdbScheduledRefreshNotice(): ShopperNotice {
  return {
    title: "TheMealDB imports refresh on a schedule",
    body: "Sale-matched TheMealDB meals use saved imports from the recipe catalog. Saved imports may still rank alongside internal recipes when they match your sale ingredients. Verify totals in store before checkout.",
  };
}

export function buildThemealdbEmptyShopperNotice(
  preferences: MealPreferenceForm,
): ShopperNotice {
  if (
    preferences.planningMode === "ingredient-first" &&
    preferences.selectedIngredientIds &&
    preferences.selectedIngredientIds.length > 0
  ) {
    return {
      title: "No TheMealDB meals for those ingredients",
      body: "Try selecting more sale items, widening your budget or ingredient limit. TheMealDB meals need at least three overlapping sale ingredients.",
    };
  }

  return {
    title: "No TheMealDB meals matched yet",
    body: "Yum4Less refreshes TheMealDB imports from sale overlap on a daily schedule. Meals need at least three overlapping sale ingredients and a defensible shopping plan before they can rank.",
  };
}

function buildThemealdbRecommendationAttribution(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
): Pick<MealRecommendation, "recipeAttribution" | "recipeAttributionUrl"> {
  const attribution = buildThemealdbAttribution({ recipe, nearbyStores });
  if (!attribution) {
    return {};
  }

  return {
    recipeAttribution: attribution.text,
    ...(attribution.url ? { recipeAttributionUrl: attribution.url } : {}),
  };
}

function buildExplanation(candidate: RecommendationCandidate, storeCount: number) {
  const budgetNote =
    candidate.score.price >= 30
      ? "the total stays comfortably under the current budget"
      : "the meal still fits the current budget";
  const storeNote =
    storeCount === 1
      ? "it can be shopped as a one-store trip"
      : "it balances savings across multiple nearby stores";
  const freshnessNote =
    candidate.score.freshness >= 16
      ? "The current price observations were checked recently, but they are not live checkout totals."
      : "Some price observations are older, so treat the total as more directional.";

  return `${candidate.recipe.title} ranks well because ${budgetNote} and ${storeNote}. ${freshnessNote}`;
}

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
