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
import { rehydratePassedMarketNearbyStores, recomputePassedMarketTrustFields, buildPricingScopeExtraNearbyStores } from "@/lib/market-pass-through-rehydrate";
import {
  getMarketSearchExperience,
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
  buildStoreSelectionSyncNotices,
  buildEquivalentStoreIdsByStoreId,
  filterPriceObservationsByStoreIds,
  filterNearbyStoresBySelection,
  mergePricingScopeStoresIntoMarket,
  mergeRankingShopperNotices,
  resolveEffectiveSelectedIngredientIds,
  resolvePricingScopeStoreIds,
  resolveSelectedStoreIdsForRanking,
  scopeMarketSummaryToSelectedStores,
} from "@/lib/store-scope";
import type { StoreIdentityEnv } from "@/lib/store-identity-flags";
import type { StoreIdentityLookup } from "@/lib/store-identity-resolvers";
import { createDefaultStoreIdentityLookup } from "@/lib/store-identity-resolvers";
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
    identityLookup?: StoreIdentityLookup;
    storeIdentityEnv?: StoreIdentityEnv;
  },
): Promise<RecommendationExperience> {
  let market: MarketSummary;
  let snapshot: MarketDataSnapshot;
  let snapshotSource: MarketDataSource;
  const identityLookup =
    options?.identityLookup ?? createDefaultStoreIdentityLookup();
  const storeIdentityEnv = options?.storeIdentityEnv;
  const identityOptions = {
    identityLookup,
    env: storeIdentityEnv,
  };

  if (options?.passedMarket) {
    market = options.passedMarket;
    const snapshotResult = await getMarketDataSnapshot();
    snapshot = snapshotResult.snapshot;
    snapshotSource = snapshotResult.source;
    market = rehydratePassedMarketNearbyStores(
      market,
      snapshot,
      location,
      identityOptions,
    );
    market = await recomputePassedMarketTrustFields({
      market,
      snapshot,
      snapshotSource,
      location,
      providerConfigured,
      ...identityOptions,
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

  const storeSelection =
    preferences.selectedStoreIds && preferences.selectedStoreIds.length > 0
      ? resolveSelectedStoreIdsForRanking({
          selectedStoreIds: preferences.selectedStoreIds,
          marketNearbyStores: market.nearbyStores,
          identityLookup,
          env: storeIdentityEnv,
        })
      : undefined;
  const effectiveSelectedStoreIds =
    storeSelection?.effectiveSelectedStoreIds ?? preferences.selectedStoreIds ?? [];
  const pricingScopeStoreIds = resolvePricingScopeStoreIds({
    selectedStoreIds: effectiveSelectedStoreIds,
    identityLookup,
    env: storeIdentityEnv,
  });

  if (storeSelection && storeSelection.droppedStoreIds.length > 0) {
    logDroppedStoreSelectionIds(storeSelection.droppedStoreIds);
  }

  let themealdbEnsureNotice: ShopperNotice | undefined;

  if (
    includesThemealdbInRankingPool(preferences) &&
    market.dataSource === "database"
  ) {
    // BOUNDARY: recipe catalog refresh is cron/script-only — never on recommendation request
    const refreshObservations =
      pricingScopeStoreIds.length > 0
        ? filterPriceObservationsByStoreIds(
            snapshot.priceObservations,
            pricingScopeStoreIds,
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

  market = mergePricingScopeStoresIntoMarket({
    market,
    pricingScopeStoreIds,
    extraNearbyStores: buildPricingScopeExtraNearbyStores({
      market,
      pricingScopeStoreIds,
      catalogStores: snapshot.stores,
      priceObservations: snapshot.priceObservations,
      location,
      recipes: snapshot.recipes,
      identityLookup,
      env: storeIdentityEnv,
    }),
  });
  market = scopeMarketSummaryToSelectedStores(market, pricingScopeStoreIds);
  const scopedObservations = filterPriceObservationsByStoreIds(
    snapshot.priceObservations,
    pricingScopeStoreIds,
  );

  const recommendationStores = filterNearbyStoresBySelection(
    market.nearbyStores,
    pricingScopeStoreIds,
  ).filter((store) => store.recommendationEnabled);
  const equivalentStoreIdsByStoreId = buildEquivalentStoreIdsByStoreId(
    recommendationStores.map((store) => store.id),
    identityLookup,
    storeIdentityEnv,
  );

  const selectionSyncNotices = storeSelection
    ? buildStoreSelectionSyncNotices(storeSelection)
    : {};

  if (recommendationStores.length === 0) {
    return finalizeRecommendationExperience(
      {
        market,
        recommendations: [],
        ...(storeSelection &&
        storeSelection.effectiveSelectedStoreIds.length === 0 &&
        storeSelection.droppedStoreIds.length > 0
          ? selectionSyncNotices
          : mergeRankingShopperNotices(selectionSyncNotices, {
              shopperNotice: {
                title: "No ranked stores near this search",
                body:
                  "Yum4Less found nearby stores for map context, but none have enough sale prices for dinner estimates in this area yet.",
              },
            })),
      },
      storeSelection,
    );
  }

  const effectiveSelectedIngredientIds = resolveEffectiveSelectedIngredientIds({
    selectedIngredientIds: preferences.selectedIngredientIds,
    priceObservations: scopedObservations,
    selectedStoreIds: pricingScopeStoreIds,
  });

  if (effectiveSelectedIngredientIds.length === 0) {
    return finalizeRecommendationExperience(
      {
        market,
        recommendations: [],
        ...mergeRankingShopperNotices(selectionSyncNotices, {
          shopperNotice: {
            title: "No sale ingredients at selected store(s)",
            body: "Try different stores, widen your search radius, or check back later — prices refresh daily.",
          },
        }),
      },
      storeSelection,
    );
  }

  const ingredientScopedRecipes = buildEligibleRecipePool({
    recipes: snapshot.recipes,
    preferences,
    priceObservations: scopedObservations,
    selectedStoreIds: pricingScopeStoreIds,
  });

  const candidates = ingredientScopedRecipes
    .map((recipe) =>
      buildCandidate(
        recipe,
        recommendationStores,
        preferences,
        scopedObservations,
        market.dataSource,
        buildValidPantryIngredientIdsFromSnapshot(snapshot),
        equivalentStoreIdsByStoreId,
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

    return finalizeRecommendationExperience(
      {
        market,
        recommendations: [],
        ...buildRankEmptyShopperNotices({
          emptyNotice,
          themealdbEnsureNotice,
          selectionSyncNotices,
        }),
      },
      storeSelection,
    );
  }

  return finalizeRecommendationExperience(
    {
      market,
      ...mergeRankingShopperNotices(
        themealdbEnsureNotice ? { shopperNotice: themealdbEnsureNotice } : undefined,
        selectionSyncNotices,
      ),
      recommendations: candidates.map((candidate) =>
        attachMealPresentation(
          candidate,
          market.providerPricingPreviews,
          market.dataSource,
          recommendationStores,
        ),
      ),
    },
    storeSelection,
  );
}

function logDroppedStoreSelectionIds(droppedStoreIds: string[]): void {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }

  console.info("[yum4less] rank store selection dropped stale ids", {
    droppedStoreIds,
  });
}

function finalizeRecommendationExperience(
  experience: RecommendationExperience,
  storeSelection?: ReturnType<typeof resolveSelectedStoreIdsForRanking>,
): RecommendationExperience {
  if (!storeSelection?.selectionChanged) {
    return experience;
  }

  return {
    ...experience,
    effectiveSelectedStoreIds: storeSelection.effectiveSelectedStoreIds,
  };
}

function includesThemealdbInRankingPool(preferences: MealPreferenceForm): boolean {
  return (
    preferences.recipeSource === "internal-library" ||
    preferences.recipeSource === "themealdb"
  );
}

function buildRankEmptyShopperNotices(input: {
  emptyNotice?: ShopperNotice;
  themealdbEnsureNotice?: ShopperNotice;
  selectionSyncNotices?: Pick<
    RecommendationExperience,
    "shopperNotice" | "supplementaryShopperNotices"
  >;
}): Pick<RecommendationExperience, "shopperNotice" | "supplementaryShopperNotices"> {
  return mergeRankingShopperNotices(
    input.emptyNotice ? { shopperNotice: input.emptyNotice } : undefined,
    input.selectionSyncNotices,
    input.themealdbEnsureNotice ? { shopperNotice: input.themealdbEnsureNotice } : undefined,
  );
}

function buildValidPantryIngredientIdsFromSnapshot(
  snapshot: MarketDataSnapshot,
): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const ingredient of snapshot.ingredients ?? []) {
    ids.add(ingredient.id);
  }

  for (const recipe of snapshot.recipes) {
    for (const line of recipe.ingredients) {
      ids.add(line.ingredientId);
    }
  }

  return ids;
}

function buildCandidate(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  preferences: MealPreferenceForm,
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
  validPantryIngredientIds: ReadonlySet<string>,
  equivalentStoreIdsByStoreId?: ReadonlyMap<string, ReadonlySet<string>>,
): RecommendationCandidate | null {
  const pantryIngredientIds = new Set(
    filterValidPantryIngredientIds(
      preferences.pantryIngredientIds ?? [],
      validPantryIngredientIds,
    ),
  );
  const planOptions = {
    ...(pantryIngredientIds.size > 0 ? { pantryIngredientIds } : {}),
    ...(equivalentStoreIdsByStoreId
      ? { equivalentStoreIdsByStoreId }
      : {}),
  };
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
