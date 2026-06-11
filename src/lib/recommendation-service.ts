import type {
  CatalogPriceObservation,
  CatalogRecipeRecord,
  CatalogStore,
} from "@/lib/market-catalog-types";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  getMarketDataSnapshot,
  type MarketDataSnapshot,
  type MarketDataSource,
} from "@/lib/market-repository";
import { getSaleConfidence, type SaleConfidence } from "@/lib/sale-confidence";
import {
  getProviderRolloutForStore,
  listResolvedProviderRollout,
  resolveProviderRolloutForStore,
  type ProviderRolloutEntry,
  type ProviderRolloutStatus,
  type StoreChain,
} from "@/lib/provider-rollout";
import {
  searchOfficialProviderStores,
} from "@/lib/provider-market-service";
import {
  deriveRankedPricingSource,
  getRankedPriceSourceKind,
  getRankedPriceSourceTier,
} from "@/lib/price-source-policy";
import {
  buildProviderCoverageRollup,
  type ProviderCoverageRollup,
} from "@/lib/provider-coverage-rollup";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import type { ProviderPriceObservationSyncSummary } from "@/lib/provider-price-observation-sync";
import {
  buildAllProviderPromotionReadiness,
  type ProviderPromotionReadiness,
} from "@/lib/provider-promotion-readiness";
import {
  buildRecipeProviderPreviewComparisons,
  type RecipeProviderPreviewComparison,
} from "@/lib/seed-vs-provider-recipe-comparison";
import type {
  ProviderPricingPreviewResult,
  ProviderStoreSearchResult,
} from "@/lib/providers/provider-types";
import {
  getWeeklyAdIngestionMarketSummaries,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import type { WeeklyAdIngestionStatusSummary } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";
import {
  buildWeeklyAdStoreCoverage,
  weeklyAdPromotionGatesPass,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";
import {
  buildWeeklyAdPromotionReadinessForStores,
  type WeeklyAdPromotionReadiness,
} from "@/lib/weekly-ad-ingestion/weekly-ad-promotion-readiness";
import {
  buildInactiveRecipeSourceShopperNotice,
  isRecipeSourceActive,
} from "@/lib/recipe-sources/recipe-source-registry";
import { ensureThemealdbRecipesForSearch } from "@/lib/recipe-import/ensure-themealdb-recipes-for-search";
import {
  buildThemealdbAttribution,
  collectSaleIngredientIdsFromObservations,
  filterRecipesForRanking,
} from "@/lib/recipe-import/recipe-ranking-eligibility";
import { filterRecipesBySource } from "@/lib/recipe-filter-by-source";
import {
  buildNearbySaleIngredientChoices,
  filterRecipesBySelectedIngredientIds,
  type SaleIngredientChoice,
} from "@/lib/sale-ingredient-offers";
import { THEMEALDB_SOURCE_NAME } from "@/lib/recipe-import/themealdb-types";

import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";

export type MealPlanningMode = "standard" | "ingredient-first";

export type MealPreferenceForm = {
  zipCode: string;
  radiusMiles: number;
  budget: number;
  maxIngredients: number;
  dinnersWanted: number;
  shoppingStyle: "single-store" | "multi-store";
  dietaryFocus: "anything" | "vegetarian" | "vegan" | "quick";
  recipeSource: RecipeSourceSelection;
  planningMode?: MealPlanningMode;
  selectedIngredientIds?: string[];
  /** Must be true when recipeSource is not internal-library. */
  recipeSourceOptIn?: boolean;
};

export type RecipeDifficulty = "easy" | "medium";

export type NearbyStoreSummary = {
  id: string;
  name: string;
  kind: CatalogStore["kind"];
  latitude: number;
  longitude: number;
  distanceMiles: number;
  chain: StoreChain;
  chainLabel: string;
  rolloutStatus: ProviderRolloutStatus;
  recommendationEnabled: boolean;
  rolloutNote: string;
  sourceName?: string;
  lastVerifiedAt?: string;
};

export type MarketSummary = {
  searchedZipCode?: string;
  locationLabel: string;
  searchLatitude: number;
  searchLongitude: number;
  radiusMiles: number;
  nearbyStores: NearbyStoreSummary[];
  recommendationReadyStoreCount: number;
  providerRollout: ProviderRolloutEntry[];
  providerStoreSearches: ProviderStoreSearchResult[];
  providerPricingPreviews: ProviderPricingPreviewResult[];
  providerCoverageRollup: ProviderCoverageRollup;
  providerPromotionReadiness: ProviderPromotionReadiness[];
  providerPriceObservationSync: ProviderPriceObservationSyncSummary[];
  weeklyAdIngestionStatus: WeeklyAdIngestionStatusSummary[];
  weeklyAdPromotionReadiness: WeeklyAdPromotionReadiness[];
  lookupSource: ResolvedSearchLocation["source"];
  lookupProviderConfigured: boolean;
  dataSource: MarketDataSource;
  /** Sale/API/scrape ingredient rows near the search point for optional shopper selection. */
  saleIngredientChoices: SaleIngredientChoice[];
  /**
   * Retired for shopper UI (TRUST-06). Structured fields above replace the old
   * concatenated blob. Omitted from public API responses.
   */
  message?: string;
};

export type ShopperNotice = {
  title: string;
  body: string;
};

export type ShoppingPlanItem = {
  ingredient: string;
  quantityNote: string;
  storeName: string;
  price: number;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  saleLabel?: string;
  priceSource?: string;
  priceSourceKind?: "official-online" | "weekly-ad" | "sample" | "unknown";
  priceSourceTier?: number;
  matchConfidence?: number;
  saleConfidence: SaleConfidence;
};

export type StorePlan = {
  storeName: string;
  subtotal: number;
  itemCount: number;
};

export type ScoreBreakdown = {
  total: number;
  price: number;
  convenience: number;
  freshness: number;
  fit: number;
};

export type MealRecommendation = {
  title: string;
  summary: string;
  estimatedTotal: number;
  storeCount: number;
  matchedIngredients: number;
  cookTimeMinutes: number;
  difficulty: RecipeDifficulty;
  primaryStore: string;
  ingredientHighlights: string[];
  instructions: string[];
  shoppingPlan: ShoppingPlanItem[];
  storePlan: StorePlan[];
  score: ScoreBreakdown;
  confidenceLabel: string;
  tags: string[];
  freshnessLabel: string;
  explanation: string;
  providerPreviewComparisons: RecipeProviderPreviewComparison[];
  recipeAttribution?: string;
  recipeAttributionUrl?: string;
};

export type RecommendationExperience = {
  market: MarketSummary;
  recommendations: MealRecommendation[];
  /** Layman notice for the main UI (e.g. inactive recipe source). */
  shopperNotice?: ShopperNotice;
};

type Candidate = {
  recipe: CatalogRecipeRecord;
  shoppingPlan: ShoppingPlanItem[];
  estimatedTotal: number;
  score: ScoreBreakdown;
  freshnessLabel: string;
  confidenceLabel: string;
};

export async function getRecommendationExperience(
  preferences: MealPreferenceForm,
  location: ResolvedSearchLocation,
  providerConfigured: boolean,
): Promise<RecommendationExperience> {
  let { market, snapshot } = await getMarketSearchExperience(
    preferences.radiusMiles,
    location,
    providerConfigured,
  );

  let themealdbEnsureNotice: ShopperNotice | undefined;

  if (
    preferences.recipeSource === "themealdb" &&
    preferences.recipeSourceOptIn === true &&
    market.dataSource === "database"
  ) {
    const saleIngredientIds = collectSaleIngredientIdsFromObservations(
      snapshot.priceObservations,
    );
    const ensureResult = await ensureThemealdbRecipesForSearch({
      recipes: snapshot.recipes,
      saleIngredientIds,
      selectedIngredientIds: preferences.selectedIngredientIds,
    });

    if (ensureResult.status === "refreshed") {
      const refreshed = await getMarketDataSnapshot();
      snapshot = refreshed.snapshot;
    }

    themealdbEnsureNotice = ensureResult.degradedNotice;
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
    preferences.planningMode === "ingredient-first" &&
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
    .filter((candidate): candidate is Candidate => candidate !== null)
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
      shopperNotice: emptyNotice ?? themealdbEnsureNotice,
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

function attachMealPresentation(
  candidate: Candidate,
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
      shoppingPlan: recommendation.shoppingPlan,
      providerPricingPreviews,
    }),
  };
}

export async function getMarketSearchExperience(
  radiusMiles: number,
  location: ResolvedSearchLocation,
  providerConfigured: boolean,
): Promise<{
  market: MarketSummary;
  snapshot: Awaited<ReturnType<typeof getMarketDataSnapshot>>["snapshot"];
}> {
  const providerStoreSearches = await searchOfficialProviderStores({
    location,
    radiusMiles,
  });

  let { snapshot, source } = await getMarketDataSnapshot();
  const recipeIngredientIds = collectRecipeIngredientIds(snapshot.recipes);
  let nearbyStores = getNearbyStores(
    snapshot.stores,
    location,
    radiusMiles,
    snapshot.priceObservations,
    recipeIngredientIds,
  );
  const providerPricingPreviews = await buildProviderPricingPreviews({
    providerStores: providerStoreSearches.flatMap((search) => search.stores),
  });

  const recommendationReadyStores = nearbyStores.filter(
    (store) => store.recommendationEnabled,
  );
  const recommendationReadyStoreIds = new Set(
    recommendationReadyStores.map((store) => store.id),
  );
  const providerCoverageRollup = buildProviderCoverageRollup(
    providerPricingPreviews,
    deriveRankedPricingSource({
      priceSources: snapshot.priceObservations
        .filter((observation) =>
          recommendationReadyStoreIds.has(observation.storeId),
        )
        .map((observation) => observation.priceSource),
      recommendationEnabledStoreCount: recommendationReadyStores.length,
    }),
  );
  const providerPromotionReadiness = buildAllProviderPromotionReadiness({
    previews: providerPricingPreviews,
  });
  const weeklyAdIngestionStatus = await getWeeklyAdIngestionMarketSummaries({
    storeIds: nearbyStores.map((store) => store.id),
  });
  const weeklyAdPromotionReadiness = buildWeeklyAdPromotionReadinessForStores({
    stores: nearbyStores.map((store) => ({
      id: store.id,
      name: store.name,
      chain: store.chain,
    })),
    coverageByStoreId: buildWeeklyAdCoverageByStoreId(
      nearbyStores,
      snapshot.priceObservations,
      recipeIngredientIds,
    ),
  });

  return {
    snapshot,
    market: buildMarketSummary(
      radiusMiles,
      nearbyStores,
      providerStoreSearches,
      providerPricingPreviews,
      providerCoverageRollup,
      providerPromotionReadiness,
      [],
      weeklyAdIngestionStatus,
      weeklyAdPromotionReadiness,
      location,
      providerConfigured,
      source,
      snapshot,
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

function getNearbyStores(
  stores: CatalogStore[],
  location: ResolvedSearchLocation,
  radiusMiles: number,
  priceObservations: CatalogPriceObservation[],
  recipeIngredientIds: string[],
): NearbyStoreSummary[] {
  return stores
    .map((store) => {
      const baseRollout = getProviderRolloutForStore(store.name);
      const coverage = buildWeeklyAdStoreCoverage({
        storeId: store.id,
        chain: baseRollout.chain,
        priceObservations,
        recipeIngredientIds,
      });
      const rollout = resolveProviderRolloutForStore(store.name, {
        matchedIngredientCount: coverage.matchedIngredientCount,
        usesWeeklyAdSource: coverage.usesWeeklyAdSource,
        weeklyAdPromotionPassed: weeklyAdPromotionGatesPass(
          coverage,
          baseRollout.chain,
        ),
      });
      return {
        id: store.id,
        name: store.name,
        kind: store.kind,
        latitude: store.latitude,
        longitude: store.longitude,
        distanceMiles: roundDistanceMiles(
          getDistanceMiles(
            location.latitude,
            location.longitude,
            store.latitude,
            store.longitude,
          ),
        ),
        chain: rollout.chain,
        chainLabel: rollout.label,
        rolloutStatus: rollout.status,
        recommendationEnabled: rollout.recommendationEnabled,
        rolloutNote: rollout.note,
        sourceName: store.sourceName,
        lastVerifiedAt: store.lastVerifiedAt,
      };
    })
    .filter((store) => store.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}

function collectRecipeIngredientIds(recipes: CatalogRecipeRecord[]): string[] {
  return [
    ...new Set(
      recipes.flatMap((recipe) =>
        recipe.ingredients.map((ingredient) => ingredient.ingredientId),
      ),
    ),
  ];
}

function buildWeeklyAdCoverageByStoreId(
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  recipeIngredientIds: string[],
) {
  const coverageByStoreId = new Map<
    string,
    ReturnType<typeof buildWeeklyAdStoreCoverage>
  >();

  for (const store of nearbyStores) {
    coverageByStoreId.set(
      store.id,
      buildWeeklyAdStoreCoverage({
        storeId: store.id,
        chain: store.chain,
        priceObservations,
        recipeIngredientIds,
      }),
    );
  }

  return coverageByStoreId;
}

function buildMarketSummary(
  radiusMiles: number,
  nearbyStores: NearbyStoreSummary[],
  providerStoreSearches: ProviderStoreSearchResult[],
  providerPricingPreviews: ProviderPricingPreviewResult[],
  providerCoverageRollup: ProviderCoverageRollup,
  providerPromotionReadiness: ProviderPromotionReadiness[],
  providerPriceObservationSync: ProviderPriceObservationSyncSummary[],
  weeklyAdIngestionStatus: WeeklyAdIngestionStatusSummary[],
  weeklyAdPromotionReadiness: WeeklyAdPromotionReadiness[],
  location: ResolvedSearchLocation,
  lookupProviderConfigured: boolean,
  dataSource: MarketDataSource,
  snapshot: MarketDataSnapshot,
): MarketSummary {
  const recommendationReadyStoreCount = nearbyStores.filter(
    (store) => store.recommendationEnabled,
  ).length;
  const saleIngredientChoices = buildNearbySaleIngredientChoices({
    nearbyStores: nearbyStores.filter((store) => store.recommendationEnabled),
    priceObservations: snapshot.priceObservations,
    ingredients: snapshot.ingredients ?? [],
  });
  const searchedZipCode = location.zipCode;
  const locationLabel =
    location.source === "browser"
      ? "Current location"
      : `${location.city}, ${location.state}`;
  const weeklyAdPromotionByChain = Object.fromEntries(
    weeklyAdPromotionReadiness
      .filter((readiness) => readiness.weeklyAdRankedPricingEnabled)
      .map((readiness) => [
        readiness.chain,
        {
          matchedIngredientCount: 0,
          usesWeeklyAdSource: true,
          weeklyAdPromotionPassed: true,
        },
      ]),
  ) as Partial<
    Record<
      StoreChain,
      {
        matchedIngredientCount: number;
        usesWeeklyAdSource: boolean;
        weeklyAdPromotionPassed: boolean;
      }
    >
  >;

  return {
    searchedZipCode,
    locationLabel,
    searchLatitude: location.latitude,
    searchLongitude: location.longitude,
    radiusMiles,
    nearbyStores,
    recommendationReadyStoreCount,
    providerRollout: listResolvedProviderRollout({
      weeklyAdPromotionByChain,
    }),
    providerStoreSearches,
    providerPricingPreviews,
    providerCoverageRollup,
    providerPromotionReadiness,
    providerPriceObservationSync,
    weeklyAdIngestionStatus,
    weeklyAdPromotionReadiness,
    lookupSource: location.source,
    lookupProviderConfigured,
    dataSource,
    saleIngredientChoices,
  };
}

function buildCandidate(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  preferences: MealPreferenceForm,
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
): Candidate | null {
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

function buildSingleStorePlan(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
): ShoppingPlanItem[] {
  const candidatePlans = nearbyStores
    .map((store) => {
      const observations = recipe.ingredients.map((ingredient) =>
        getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        ),
      );
      if (observations.some((observation) => observation === undefined)) {
        return null;
      }

      return recipe.ingredients.map((ingredient, index) =>
        toShoppingPlanItem(
          ingredient.displayName,
          ingredient.quantityNote,
          observations[index]!,
          store.name,
          dataSource,
        ),
      );
    })
    .filter((plan): plan is ShoppingPlanItem[] => plan !== null);

  if (candidatePlans.length === 0) {
    return [];
  }

  return candidatePlans.sort(
    (left, right) => comparePlanQuality(left, right),
  )[0]!;
}

function buildMultiStorePlan(
  recipe: CatalogRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: CatalogPriceObservation[],
  dataSource: MarketDataSource,
): ShoppingPlanItem[] {
  const plan: ShoppingPlanItem[] = [];

  for (const ingredient of recipe.ingredients) {
    const bestObservation = nearbyStores
      .map((store) => ({
        store,
        observation: getObservationForStore(
          priceObservations,
          store.id,
          ingredient.ingredientId,
        ),
      }))
      .filter(
        (
          candidate,
        ): candidate is { store: NearbyStoreSummary; observation: CatalogPriceObservation } =>
          candidate.observation !== undefined,
      )
      .sort((left, right) =>
        compareObservationQuality(left.observation, right.observation),
      )[0];

    if (!bestObservation) {
      return [];
    }

    plan.push(
      toShoppingPlanItem(
        ingredient.displayName,
        ingredient.quantityNote,
        bestObservation.observation,
        bestObservation.store.name,
        dataSource,
      ),
    );
  }

  return plan;
}

function getObservationForStore(
  priceObservations: CatalogPriceObservation[],
  storeId: string,
  ingredientId: string,
) {
  return priceObservations.find(
    (observation) =>
      observation.storeId === storeId &&
      observation.ingredientId === ingredientId &&
      observation.inStock,
  );
}

function toShoppingPlanItem(
  ingredient: string,
  quantityNote: string,
  observation: CatalogPriceObservation,
  storeName: string,
  dataSource: MarketDataSource,
): ShoppingPlanItem {
  return {
    ingredient,
    quantityNote,
    storeName,
    price: observation.price,
    freshnessDaysAgo: observation.freshnessDaysAgo,
    freshnessHoursAgo: observation.freshnessHoursAgo,
    saleLabel: observation.saleLabel,
    priceSource: observation.priceSource,
    priceSourceKind:
      observation.priceSourceKind ?? getRankedPriceSourceKind(observation.priceSource),
    priceSourceTier:
      observation.priceSourceTier ?? getRankedPriceSourceTier(observation.priceSource),
    matchConfidence: observation.matchConfidence,
    saleConfidence: getSaleConfidence({
      saleLabel: observation.saleLabel,
      freshnessDaysAgo: observation.freshnessDaysAgo,
      freshnessHoursAgo: observation.freshnessHoursAgo,
      dataSource,
      priceSource: observation.priceSource,
      matchConfidence: observation.matchConfidence,
    }),
  };
}

function scoreCandidate({
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

function toRecommendation(
  candidate: Candidate,
  dataSource: MarketDataSource,
  nearbyStores: NearbyStoreSummary[],
): Omit<MealRecommendation, "providerPreviewComparisons"> {
  const storePlan = Array.from(
    candidate.shoppingPlan.reduce((map, item) => {
      const entry = map.get(item.storeName) ?? {
        storeName: item.storeName,
        subtotal: 0,
        itemCount: 0,
      };
      entry.subtotal += item.price;
      entry.itemCount += 1;
      map.set(item.storeName, entry);
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
      saleConfidence: getSaleConfidence({
        saleLabel: item.saleLabel,
        freshnessDaysAgo: item.freshnessDaysAgo,
        freshnessHoursAgo: item.freshnessHoursAgo,
        dataSource,
        priceSource: item.priceSource,
        matchConfidence: item.matchConfidence,
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

function buildThemealdbEmptyShopperNotice(
  preferences: MealPreferenceForm,
): ShopperNotice {
  if (
    preferences.planningMode === "ingredient-first" &&
    preferences.selectedIngredientIds &&
    preferences.selectedIngredientIds.length > 0
  ) {
    return {
      title: "No TheMealDB meals for those ingredients",
      body: "Try selecting more sale items, widening your budget or ingredient limit, or uncheck TheMealDB to rank from the internal library. TheMealDB meals need at least three overlapping weekly-ad sale ingredients.",
    };
  }

  return {
    title: "No TheMealDB meals matched yet",
    body: "Yum4Less refreshes TheMealDB imports from weekly-ad sale overlap on a daily schedule. Meals need at least three overlapping sale ingredients and a defensible shopping plan before they can rank.",
  };
}

function buildExplanation(candidate: Candidate, storeCount: number) {
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

function getFreshnessLabel(shoppingPlan: ShoppingPlanItem[]) {
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
    return "Recent weekly-ad prices";
  }
  return "Older prices — verify in store";
}

function comparePlanQuality(left: ShoppingPlanItem[], right: ShoppingPlanItem[]) {
  const leftQuality = getPlanQuality(left);
  const rightQuality = getPlanQuality(right);

  return (
    leftQuality.averageTier - rightQuality.averageTier ||
    leftQuality.averageFreshnessHours - rightQuality.averageFreshnessHours ||
    rightQuality.averageConfidence - leftQuality.averageConfidence ||
    leftQuality.total - rightQuality.total
  );
}

function getPlanQuality(plan: ShoppingPlanItem[]) {
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

function compareObservationQuality(
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

function getConfidenceLabel(shoppingPlan: ShoppingPlanItem[]) {
  const storeCount = new Set(shoppingPlan.map((item) => item.storeName)).size;
  if (storeCount === 1) {
    return "Single-store estimate";
  }
  return "Multi-store estimate";
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundDistanceMiles(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDistanceMiles(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
