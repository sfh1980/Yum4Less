import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { MarketDataSnapshot, MarketDataSource } from "@/lib/market-repository";
import { rehydratePassedMarketNearbyStores, recomputePassedMarketTrustFields } from "@/lib/market-pass-through-rehydrate";
import {
  getMarketSearchExperience,
} from "@/lib/market-search-service";
import {
  filterNearbyStoresBySelection,
  filterPriceObservationsByStoreIds,
  resolveSelectedStoreIdsForRanking,
  scopeMarketSummaryToSelectedStores,
} from "@/lib/store-scope";
import type { PantryCoverageExperience } from "@/contracts/pantry-coverage";
import type { MealPreferenceForm, MarketSummary } from "@/lib/recommendation-types";
import { RecommendationDependencyUnavailableError } from "@/lib/recommendation-types";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { loadCatalogIngredients } from "@/lib/market-catalog-repository";
import { buildEligibleRecipePool } from "@/lib/ranking-recipe-pool";
import {
  assessRecipePoolCoverage,
  buildCatalogById,
  buildCatalogIdSet,
  buildIngredientCatalogForClient,
  buildSuggestedPantryChecklist,
  countFullyCoveredRecipes,
  filterValidPantryIngredientIds,
} from "@/lib/recipe-plan-coverage";

export type PantryCoverageServiceInput = MealPreferenceForm & {
  pantryIngredientIds?: string[];
  includeIngredientCatalog?: boolean;
};

export async function getPantryCoverageExperience(
  preferences: PantryCoverageServiceInput,
  location: ResolvedSearchLocation,
  providerConfigured: boolean,
  options?: {
    passedMarket?: MarketSummary;
  },
): Promise<PantryCoverageExperience> {
  const ingredientCatalog = await loadCatalogIngredients();
  const catalogById = buildCatalogById(ingredientCatalog);
  const validIngredientIds = buildCatalogIdSet(ingredientCatalog);

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

  if (!preferences.selectedStoreIds || preferences.selectedStoreIds.length === 0) {
    return {
      suggestedChecklist: [],
      fullyCoveredRecipeCount: 0,
      eligibleRecipeCount: 0,
      ...(preferences.includeIngredientCatalog
        ? { ingredientCatalog: buildIngredientCatalogForClient(ingredientCatalog) }
        : {}),
    };
  }

  const storeSelection = resolveSelectedStoreIdsForRanking({
    selectedStoreIds: preferences.selectedStoreIds,
    marketNearbyStores: market.nearbyStores,
  });
  const effectiveSelectedStoreIds = storeSelection.effectiveSelectedStoreIds;

  market = scopeMarketSummaryToSelectedStores(market, effectiveSelectedStoreIds);
  const scopedObservations = filterPriceObservationsByStoreIds(
    snapshot.priceObservations,
    effectiveSelectedStoreIds,
  );

  const recommendationStores = filterNearbyStoresBySelection(
    market.nearbyStores,
    effectiveSelectedStoreIds,
  ).filter((store) => store.recommendationEnabled);

  if (recommendationStores.length === 0) {
    return {
      suggestedChecklist: [],
      fullyCoveredRecipeCount: 0,
      eligibleRecipeCount: 0,
      ...(preferences.includeIngredientCatalog
        ? { ingredientCatalog: buildIngredientCatalogForClient(ingredientCatalog) }
        : {}),
    };
  }

  const eligibleRecipes = buildEligibleRecipePool({
    recipes: snapshot.recipes,
    preferences,
    priceObservations: scopedObservations,
    selectedStoreIds: effectiveSelectedStoreIds,
  });

  const pantryIngredientIds = filterValidPantryIngredientIds(
    preferences.pantryIngredientIds ?? [],
    validIngredientIds,
  );
  const pantrySet = new Set(pantryIngredientIds);

  const assessments = assessRecipePoolCoverage(eligibleRecipes, {
    stores: recommendationStores,
    observations: scopedObservations,
    shoppingStyle: preferences.shoppingStyle,
    pantryIngredientIds: pantrySet,
  });

  return {
    suggestedChecklist: buildSuggestedPantryChecklist(assessments, catalogById),
    fullyCoveredRecipeCount: countFullyCoveredRecipes(assessments),
    eligibleRecipeCount: eligibleRecipes.length,
    ...(preferences.includeIngredientCatalog
      ? { ingredientCatalog: buildIngredientCatalogForClient(ingredientCatalog) }
      : {}),
  };
}
