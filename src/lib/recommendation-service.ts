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
import { rehydratePassedMarketNearbyStores } from "@/lib/market-pass-through-rehydrate";
import {
  getMarketSearchExperience,
  buildNearbyStoresForSearch,
  collectRecipeIngredientIdsForRollout,
} from "@/lib/market-search-service";
import {
  buildInactiveRecipeSourceShopperNotice,
  isRecipeSourceActive,
} from "@/lib/recipe-sources/recipe-source-registry";
import {
  getLatestThemealdbImportAt,
  shouldRefreshThemealdbRecipesOnSearch,
} from "@/lib/recipe-import/ensure-themealdb-recipes-for-search";
import {
  collectSaleIngredientIdsFromObservations,
  filterRecipesForRanking,
} from "@/lib/recipe-import/recipe-ranking-eligibility";
import { filterRecipesBySource } from "@/lib/recipe-filter-by-source";
import { filterRecipesBySelectedIngredientIds } from "@/lib/sale-ingredient-offers";
import {
  getConfidenceLabel,
  getFreshnessLabel,
  scoreCandidate,
} from "@/lib/recommendation-scoring";
import {
  buildMultiStorePlan,
  buildSingleStorePlan,
} from "@/lib/shopping-plan-builder";
import {
  attachMealPresentation,
  buildThemealdbEmptyShopperNotice,
  buildThemealdbScheduledRefreshNotice,
  roundCurrency,
} from "@/lib/meal-presentation";
import {
  DEFAULT_DINNERS_WANTED,
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
  DEFAULT_DINNERS_WANTED,
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
    preferences.recipeSource === "themealdb" &&
    preferences.recipeSourceOptIn === true &&
    market.dataSource === "database"
  ) {
    // BOUNDARY: recipe catalog refresh is cron/script-only — never on recommendation request
    const saleIngredientIds = collectSaleIngredientIdsFromObservations(
      snapshot.priceObservations,
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

  if (!isRecipeSourceActive(preferences.recipeSource)) {
    return {
      market,
      recommendations: [],
      shopperNotice: buildInactiveRecipeSourceShopperNotice(
        preferences.recipeSource,
      ),
    };
  }

  if (
    preferences.recipeSource !== "internal-library" &&
    preferences.recipeSourceOptIn !== true
  ) {
    return {
      market,
      recommendations: [],
      shopperNotice: {
        title: "Recipe source requires opt-in",
        body: "Yum4Less ranks from the internal recipe library by default. Check the TheMealDB opt-in before ranking, or use Suggest recipes with your selected ingredients.",
      },
    };
  }

  if (
    (preferences.planningMode ?? DEFAULT_PLANNING_MODE) === "ingredient-first" &&
    (!preferences.selectedIngredientIds || preferences.selectedIngredientIds.length === 0)
  ) {
    return {
      market,
      recommendations: [],
      shopperNotice: {
        title: "Select sale ingredients first",
        body: "Turn on Browse sale ingredients, check the items you want to cook with, then ask for recipe ideas.",
      },
    };
  }

  const recommendationStores = market.nearbyStores.filter(
    (store) => store.recommendationEnabled,
  );

  if (recommendationStores.length === 0) {
    return {
      market,
      recommendations: [],
      shopperNotice: {
        title: "No ranked stores near this search",
        body:
          "Yum4Less found nearby stores for map context, but none pass Kroger-family or Aldi ranked pricing gates in this area yet. Meal estimates need ingested sale prices from a ready store.",
      },
    };
  }

  const saleIngredientIds = collectSaleIngredientIdsFromObservations(
    snapshot.priceObservations,
  );
  const sourceFilteredRecipes = filterRecipesBySource(
    snapshot.recipes,
    preferences.recipeSource,
  );
  const rankableRecipes = filterRecipesForRanking({
    recipes: sourceFilteredRecipes,
    saleIngredientIds,
  });
  const ingredientScopedRecipes = filterRecipesBySelectedIngredientIds(
    rankableRecipes,
    preferences.selectedIngredientIds,
  );

  const candidates = ingredientScopedRecipes
    .filter((recipe) => byDietaryFocus(recipe, preferences.dietaryFocus))
    .map((recipe) =>
      buildCandidate(
        recipe,
        recommendationStores,
        preferences,
        snapshot.priceObservations,
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
              body: "Try selecting more sale items, widening your budget or ingredient limit, or switch recipe source.",
            }
          : undefined;

    return {
      market,
      recommendations: [],
      shopperNotice: themealdbEnsureNotice ?? emptyNotice,
    };
  }

  return {
    market,
    ...(themealdbEnsureNotice ? { shopperNotice: themealdbEnsureNotice } : {}),
    recommendations: candidates
      .slice(0, preferences.dinnersWanted)
      .map((candidate) =>
        attachMealPresentation(
          candidate,
          market.providerPricingPreviews,
          market.dataSource,
          recommendationStores,
        ),
      ),
  };
}

function byDietaryFocus(
  recipe: CatalogRecipeRecord,
  dietaryFocus: MealPreferenceForm["dietaryFocus"],
) {
  if (dietaryFocus === "anything") {
    return true;
  }

  return recipe.dietaryTags.includes(dietaryFocus);
}

function buildCandidate(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  preferences: MealPreferenceForm,
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
): RecommendationCandidate | null {
  const shoppingPlan =
    preferences.shoppingStyle === "single-store"
      ? buildSingleStorePlan(recipe, nearbyStores, priceObservations, dataSource)
      : buildMultiStorePlan(recipe, nearbyStores, priceObservations, dataSource);

  if (shoppingPlan.length === 0) {
    return null;
  }

  const estimatedTotal = roundCurrency(
    shoppingPlan.reduce((sum, item) => sum + item.price, 0),
  );

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
