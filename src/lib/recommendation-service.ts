import type {
  MockPriceObservation,
  MockRecipeRecord,
  MockStore,
} from "@/lib/mock-market-data";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  getMarketDataSnapshot,
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
import { deriveRankedPricingSource } from "@/lib/price-source-policy";
import {
  buildProviderCoverageRollup,
  type ProviderCoverageRollup,
} from "@/lib/provider-coverage-rollup";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import { isPublicApiDbWriteEnabled } from "@/lib/public-api-db-write-policy";
import {
  syncProviderPreviewsToPriceObservations,
  type ProviderPriceObservationSyncSummary,
} from "@/lib/provider-price-observation-sync";
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

import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";

export type MealPreferenceForm = {
  zipCode: string;
  radiusMiles: number;
  budget: number;
  maxIngredients: number;
  dinnersWanted: number;
  shoppingStyle: "single-store" | "multi-store";
  dietaryFocus: "anything" | "vegetarian" | "vegan" | "quick";
  recipeSource: RecipeSourceSelection;
};

export type RecipeDifficulty = "easy" | "medium";

export type NearbyStoreSummary = {
  id: string;
  name: string;
  kind: MockStore["kind"];
  latitude: number;
  longitude: number;
  distanceMiles: number;
  chain: StoreChain;
  chainLabel: string;
  rolloutStatus: ProviderRolloutStatus;
  recommendationEnabled: boolean;
  rolloutNote: string;
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
  saleLabel?: string;
  priceSource?: string;
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
};

export type RecommendationExperience = {
  market: MarketSummary;
  recommendations: MealRecommendation[];
  /** Layman notice for the main UI (e.g. inactive recipe source). */
  shopperNotice?: ShopperNotice;
};

type Candidate = {
  recipe: MockRecipeRecord;
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
  const { market, snapshot } = await getMarketSearchExperience(
    preferences.radiusMiles,
    location,
    providerConfigured,
  );

  if (!isRecipeSourceActive(preferences.recipeSource)) {
    return {
      market,
      recommendations: [],
      shopperNotice: buildInactiveRecipeSourceShopperNotice(
        preferences.recipeSource,
      ),
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

  const candidates = snapshot.recipes
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

  return {
    market,
    recommendations: candidates
      .slice(0, preferences.dinnersWanted)
      .map((candidate) =>
        attachMealPresentation(
          candidate,
          market.providerPricingPreviews,
          market.dataSource,
        ),
      ),
  };
}

function attachMealPresentation(
  candidate: Candidate,
  providerPricingPreviews: ProviderPricingPreviewResult[],
  dataSource: MarketDataSource,
): MealRecommendation {
  const recommendation = toRecommendation(candidate, dataSource);

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
  let { snapshot, source } = await getMarketDataSnapshot();
  const recipeIngredientIds = collectRecipeIngredientIds(snapshot.recipes);
  let nearbyStores = getNearbyStores(
    snapshot.stores,
    location,
    radiusMiles,
    snapshot.priceObservations,
    recipeIngredientIds,
  );
  const providerStoreSearches = await searchOfficialProviderStores({
    location,
    radiusMiles,
  });
  const providerPricingPreviews = await buildProviderPricingPreviews({
    providerStores: providerStoreSearches.flatMap((search) => search.stores),
  });
  const providerPriceObservationSync = isPublicApiDbWriteEnabled()
    ? await syncProviderPreviewsToPriceObservations({
        previews: providerPricingPreviews,
        nearbyStores,
      })
    : [];

  if (providerPriceObservationSync.some((summary) => summary.syncedCount > 0)) {
    const refreshed = await getMarketDataSnapshot();
    snapshot = refreshed.snapshot;
    source = refreshed.source;
    nearbyStores = getNearbyStores(
      snapshot.stores,
      location,
      radiusMiles,
      snapshot.priceObservations,
      recipeIngredientIds,
    );
  }

  const providerCoverageRollup = buildProviderCoverageRollup(
    providerPricingPreviews,
    deriveRankedPricingSource({
      priceSources: snapshot.priceObservations.map(
        (observation) => observation.priceSource,
      ),
      recommendationEnabledStoreCount: nearbyStores.filter(
        (store) => store.recommendationEnabled,
      ).length,
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
      providerPriceObservationSync,
      weeklyAdIngestionStatus,
      weeklyAdPromotionReadiness,
      location,
      providerConfigured,
      source,
    ),
  };
}

function byDietaryFocus(
  recipe: MockRecipeRecord,
  dietaryFocus: MealPreferenceForm["dietaryFocus"],
) {
  if (dietaryFocus === "anything") {
    return true;
  }

  return recipe.dietaryTags.includes(dietaryFocus);
}

function getNearbyStores(
  stores: MockStore[],
  location: ResolvedSearchLocation,
  radiusMiles: number,
  priceObservations: MockPriceObservation[],
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
      };
    })
    .filter((store) => store.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}

function collectRecipeIngredientIds(recipes: MockRecipeRecord[]): string[] {
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
  priceObservations: MockPriceObservation[],
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
): MarketSummary {
  const recommendationReadyStoreCount = nearbyStores.filter(
    (store) => store.recommendationEnabled,
  ).length;
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
  };
}

function buildCandidate(
  recipe: MockRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  preferences: MealPreferenceForm,
  priceObservations: MockPriceObservation[],
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
  recipe: MockRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: MockPriceObservation[],
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
    (left, right) =>
      left.reduce((sum, item) => sum + item.price, 0) -
      right.reduce((sum, item) => sum + item.price, 0),
  )[0]!;
}

function buildMultiStorePlan(
  recipe: MockRecipeRecord,
  nearbyStores: NearbyStoreSummary[],
  priceObservations: MockPriceObservation[],
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
        ): candidate is { store: NearbyStoreSummary; observation: MockPriceObservation } =>
          candidate.observation !== undefined,
      )
      .sort((left, right) => left.observation.price - right.observation.price)[0];

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
  priceObservations: MockPriceObservation[],
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
  observation: MockPriceObservation,
  storeName: string,
  dataSource: MarketDataSource,
): ShoppingPlanItem {
  return {
    ingredient,
    quantityNote,
    storeName,
    price: observation.price,
    freshnessDaysAgo: observation.freshnessDaysAgo,
    saleLabel: observation.saleLabel,
    priceSource: observation.priceSource,
    matchConfidence: observation.matchConfidence,
    saleConfidence: getSaleConfidence({
      saleLabel: observation.saleLabel,
      freshnessDaysAgo: observation.freshnessDaysAgo,
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
  recipe: MockRecipeRecord;
  shoppingPlan: ShoppingPlanItem[];
  preferences: MealPreferenceForm;
  estimatedTotal: number;
}): ScoreBreakdown {
  const storeCount = new Set(shoppingPlan.map((item) => item.storeName)).size;
  const averageFreshnessDays =
    shoppingPlan.reduce((sum, item) => sum + item.freshnessDaysAgo, 0) /
    shoppingPlan.length;
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
  const freshness = clamp(Math.round(20 - averageFreshnessDays * 3), 4, 20);
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
    primaryStore: storePlan[0]?.storeName ?? "Mock store",
    ingredientHighlights: candidate.recipe.ingredients
      .slice(0, 3)
      .map((ingredient) => ingredient.displayName.toLowerCase()),
    instructions: candidate.recipe.steps,
    shoppingPlan: candidate.shoppingPlan.map((item) => ({
      ...item,
      saleConfidence: getSaleConfidence({
        saleLabel: item.saleLabel,
        freshnessDaysAgo: item.freshnessDaysAgo,
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
      ? "The current price observations are relatively fresh."
      : "Some price observations are older, so treat the total as more directional.";

  return `${candidate.recipe.title} ranks well because ${budgetNote} and ${storeNote}. ${freshnessNote}`;
}

function getFreshnessLabel(shoppingPlan: ShoppingPlanItem[]) {
  const averageDays =
    shoppingPlan.reduce((sum, item) => sum + item.freshnessDaysAgo, 0) /
    shoppingPlan.length;

  if (averageDays <= 2) {
    return "Recent prices";
  }
  if (averageDays <= 3.5) {
    return "Prices from this week";
  }
  return "Older prices — verify in store";
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
