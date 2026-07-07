import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
} from "@/lib/market-catalog-types";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  getMarketDataSnapshot,
  type MarketDataSnapshot,
  type MarketDataSource,
} from "@/lib/market-repository";
import { rehydratePassedMarketNearbyStores, recomputePassedMarketTrustFields } from "@/lib/market-pass-through-rehydrate";
import {
  getMarketSearchExperience,
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
} from "@/lib/market-search-service";
import {
  buildInactiveRecipeSourceShopperNotice,
} from "@/lib/recipe-sources/recipe-source-registry";
import {
  getLatestThemealdbImportAt,
  shouldRefreshThemealdbRecipesOnSearch,
} from "@/lib/recipe-import/ensure-themealdb-recipes-for-search";
import {
  collectSaleIngredientIdsFromObservations,
} from "@/lib/recipe-import/recipe-ranking-eligibility";
import {
  filterPriceObservationsByStoreIds,
  filterNearbyStoresBySelection,
  resolveEffectiveSelectedIngredientIds,
  scopeMarketSummaryToSelectedStores,
} from "@/lib/store-scope";
import { buildEligibleRecipePool } from "@/lib/ranking-recipe-pool";
import {
  getConfidenceLabel,
  getFreshnessLabel,
  scoreCandidate,
} from "@/lib/recommendation-scoring";
import {
  buildMultiStorePlan,
  buildSingleStorePlan,
  sumStorePricedPlanTotal,
} from "@/lib/shopping-plan-builder";
import { filterValidPantryIngredientIds } from "@/lib/recipe-plan-coverage";
import {
  attachMealPresentation,
  buildThemealdbEmptyShopperNotice,
  buildThemealdbScheduledRefreshNotice,
  roundCurrency,
} from "@/lib/meal-presentation";
import {
  DEFAULT_MAX_INGREDIENTS,
  DEFAULT_PLANNING_MODE,
} from "@/lib/meal-preference-defaults";
import {
  RecommendationDependencyUnavailableError,
  type MealPreferenceForm,
  type MarketSummary,
  type NearbyStoreSummary,
  type RecommendationCandidate,
  type RecommendationExperience,
  type ShopperNotice,
} from "@/lib/recommendation-types";

export {
  DEFAULT_MAX_INGREDIENTS,
  DEFAULT_PLANNING_MODE,
} from "@/lib/meal-preference-defaults";

export {
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
  getMarketSearchExperience,
} from "@/lib/market-search-service";

export {
  buildMultiStorePlan,
  buildSingleStorePlan,
} from "@/lib/shopping-plan-builder";

export {
  compareObservationQuality,
  comparePlanQuality,
  getConfidenceLabel,
  getFreshnessLabel,
  getPlanQuality,
  scoreCandidate,
} from "@/lib/recommendation-scoring";

export {
  RecommendationDependencyUnavailableError,
  type MealPlanningMode,
  type MealPreferenceForm,
  type MealRecommendation,
  type MarketSummary,
  type NearbyStoreSummary,
  type RecipeDifficulty,
  type RecommendationExperience,
  type ScoreBreakdown,
  type ShopperNotice,
  type ShoppingPlanItem,
  type StorePlan,
} from "@/lib/recommendation-types";

export async function getRecommendationExperience(
  preferences: MealPreferenceForm,
  location: ResolvedSearchLocation,
  providerConfigured: boolean,
  options?: {
    passedMarket?: MarketSummary;
  },
): Promise<RecommendationExperience> {
  let market: MarketSummary;
  let snapshot: MarketDataSnapshot;
  let snapshotSource: MarketDataSource;

  if (options?.passedMarket) {
    market = options.passedMarket;
    const snapshotResult = await getMarketDataSnapshot();
    snapshot = snapshotResult.snapshot;
    snapshotSource = snapshotResult.source;
    market = rehydratePassedMarketNearbyStores(market, snapshot, location);
    market = await recomputePassedMarketTrustFields({
      market,
      snapshot,
      snapshotSource,
      location,
      providerConfigured,
    });
  } else {
    const searchExperience = await getMarketSearchExperience(
      preferences.radiusMiles,
      location,
      providerConfigured,
    );
    market = searchExperience.market;
    snapshot = searchExperience.snapshot;
    snapshotSource = market.dataSource;
  }

  if (snapshotSource === "unavailable" || market.dataSource === "unavailable") {
    throw new RecommendationDependencyUnavailableError();
  }

  let themealdbEnsureNotice: ShopperNotice | undefined;

  if (
    includesThemealdbInRankingPool(preferences) &&
    market.dataSource === "database"
  ) {
    // BOUNDARY: recipe catalog refresh is cron/script-only — never on recommendation request
    const refreshObservations =
      preferences.selectedStoreIds && preferences.selectedStoreIds.length > 0
        ? filterPriceObservationsByStoreIds(
            snapshot.priceObservations,
            preferences.selectedStoreIds,
          )
        : snapshot.priceObservations;
    const saleIngredientIds = collectSaleIngredientIdsFromObservations(
      refreshObservations,
    );
    const latestImportAt = await getLatestThemealdbImportAt();
    const needsCatalogRefresh = shouldRefreshThemealdbRecipesOnSearch({
      recipes: snapshot.recipes,
      saleIngredientIds,
      selectedIngredientIds: preferences.selectedIngredientIds,
      latestImportAt,
    });

    if (needsCatalogRefresh) {
      themealdbEnsureNotice = buildThemealdbScheduledRefreshNotice();
    }
  }

  if (
    preferences.recipeSource !== "internal-library" &&
    preferences.recipeSource !== "themealdb"
  ) {
    return {
      market,
      recommendations: [],
      shopperNotice: buildInactiveRecipeSourceShopperNotice(
        preferences.recipeSource,
      ),
    };
  }

  if (!preferences.selectedStoreIds || preferences.selectedStoreIds.length === 0) {
    return {
      market,
      recommendations: [],
      shopperNotice: {
        title: "Select store(s) first",
        body: "Choose which nearby store or stores to shop before ranking meal estimates.",
      },
    };
  }

  market = scopeMarketSummaryToSelectedStores(market, preferences.selectedStoreIds);
  const scopedObservations = filterPriceObservationsByStoreIds(
    snapshot.priceObservations,
    preferences.selectedStoreIds,
  );

  const recommendationStores = filterNearbyStoresBySelection(
    market.nearbyStores,
    preferences.selectedStoreIds,
  ).filter((store) => store.recommendationEnabled);

  if (recommendationStores.length === 0) {
    return {
      market,
      recommendations: [],
      shopperNotice: {
        title: "No ranked stores near this search",
        body:
          "Yum4Less found nearby stores for map context, but none have enough sale prices for dinner estimates in this area yet.",
      },
    };
  }

  const effectiveSelectedIngredientIds = resolveEffectiveSelectedIngredientIds({
    selectedIngredientIds: preferences.selectedIngredientIds,
    priceObservations: scopedObservations,
    selectedStoreIds: preferences.selectedStoreIds,
  });

  if (effectiveSelectedIngredientIds.length === 0) {
    return {
      market,
      recommendations: [],
      shopperNotice: {
        title: "No sale ingredients at selected store(s)",
        body: "Try different stores, widen your search radius, or check back later — prices refresh daily.",
      },
    };
  }

  const ingredientScopedRecipes = buildEligibleRecipePool({
    recipes: snapshot.recipes,
    preferences,
    priceObservations: scopedObservations,
    selectedStoreIds: preferences.selectedStoreIds,
  });

  const candidates = ingredientScopedRecipes
    .map((recipe) =>
      buildCandidate(
        recipe,
        recommendationStores,
        preferences,
        scopedObservations,
        market.dataSource,
      ),
    )
    .filter((candidate): candidate is RecommendationCandidate => candidate !== null)
    .filter((candidate) => candidate.estimatedTotal <= preferences.budget)
    .filter(
      (candidate) =>
        candidate.shoppingPlan.length <= preferences.maxIngredients,
    )
    .sort((left, right) => right.score.total - left.score.total);

  if (candidates.length === 0) {
    const emptyNotice =
      preferences.recipeSource === "themealdb"
        ? buildThemealdbEmptyShopperNotice(preferences)
        : preferences.planningMode === "ingredient-first"
          ? {
              title: "No recipe ideas for those ingredients",
              body: "Try selecting more sale items, widening your budget or ingredient limit, or adjust dietary filters.",
            }
          : undefined;

    return {
      market,
      recommendations: [],
      ...buildRankEmptyShopperNotices({
        emptyNotice,
        themealdbEnsureNotice,
      }),
    };
  }

  return {
    market,
    ...(themealdbEnsureNotice ? { shopperNotice: themealdbEnsureNotice } : {}),
    recommendations: candidates.map((candidate) =>
        attachMealPresentation(
          candidate,
          market.providerPricingPreviews,
          market.dataSource,
          recommendationStores,
        ),
      ),
  };
}

function includesThemealdbInRankingPool(preferences: MealPreferenceForm): boolean {
  return (
    preferences.recipeSource === "internal-library" ||
    preferences.recipeSource === "themealdb"
  );
}

/** Empty rank: honest no-meals copy first; TheMealDB schedule info is additive (C1). */
function buildRankEmptyShopperNotices(input: {
  emptyNotice?: ShopperNotice;
  themealdbEnsureNotice?: ShopperNotice;
}): Pick<RecommendationExperience, "shopperNotice" | "supplementaryShopperNotices"> {
  const ordered = [input.emptyNotice, input.themealdbEnsureNotice].filter(
    (notice): notice is ShopperNotice => notice !== undefined,
  );

  if (ordered.length === 0) {
    return {};
  }

  if (ordered.length === 1) {
    return { shopperNotice: ordered[0] };
  }

  return {
    shopperNotice: ordered[0],
    supplementaryShopperNotices: ordered.slice(1),
  };
}

function buildCandidate(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  preferences: MealPreferenceForm,
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
): RecommendationCandidate | null {
  const pantryIngredientIds = new Set(
    filterValidPantryIngredientIds(preferences.pantryIngredientIds ?? []),
  );
  const planOptions =
    pantryIngredientIds.size > 0 ? { pantryIngredientIds } : undefined;
  const shoppingPlan =
    preferences.shoppingStyle === "single-store"
      ? buildSingleStorePlan(
          recipe,
          nearbyStores,
          priceObservations,
          dataSource,
          planOptions,
        )
      : buildMultiStorePlan(
          recipe,
          nearbyStores,
          priceObservations,
          dataSource,
          planOptions,
        );

  if (shoppingPlan.length === 0) {
    return null;
  }

  const estimatedTotal = roundCurrency(sumStorePricedPlanTotal(shoppingPlan));

  return {
    recipe,
    shoppingPlan,
    estimatedTotal,
    score: scoreCandidate({
      recipe,
      shoppingPlan,
      preferences,
      estimatedTotal,
    }),
    freshnessLabel: getFreshnessLabel(shoppingPlan),
    confidenceLabel: getConfidenceLabel(shoppingPlan),
  };
}
