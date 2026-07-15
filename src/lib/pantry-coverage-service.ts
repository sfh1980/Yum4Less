import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import type { MarketDataSnapshot, MarketDataSource } from "@/lib/market-repository";
import { rehydratePassedMarketNearbyStores, recomputePassedMarketTrustFields, buildPricingScopeExtraNearbyStores } from "@/lib/market-pass-through-rehydrate";
import {
  buildEquivalentStoreIdsByStoreId,
  filterNearbyStoresBySelection,
  filterPriceObservationsByStoreIds,
  mergePricingScopeStoresIntoMarket,
  resolvePricingScopeStoreIds,
  resolveSelectedStoreIdsForRanking,
  scopeMarketSummaryToSelectedStores,
} from "@/lib/store-scope";
import {
  getMarketSearchExperience,
} from "@/lib/market-search-service";
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
import type { StoreIdentityEnv } from "@/lib/store-identity-flags";
import type { StoreIdentityLookup } from "@/lib/store-identity-resolvers";
import { resolveServerStoreIdentityLookup } from "@/lib/store-identity-server-lookup";

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
    identityLookup?: StoreIdentityLookup;
    storeIdentityEnv?: StoreIdentityEnv;
  },
): Promise<PantryCoverageExperience> {
  const ingredientCatalog = await loadCatalogIngredients();
  const catalogById = buildCatalogById(ingredientCatalog);
  const validIngredientIds = buildCatalogIdSet(ingredientCatalog);
  const { identityLookup, env: storeIdentityEnv } =
    await resolveServerStoreIdentityLookup({
      identityLookup: options?.identityLookup,
      env: options?.storeIdentityEnv,
    });
  const identityOptions = {
    identityLookup,
    env: storeIdentityEnv,
  };

  let market: MarketSummary;
  let snapshot: MarketDataSnapshot;
  let snapshotSource: MarketDataSource;

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
      identityOptions,
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
    identityLookup,
    env: storeIdentityEnv,
  });
  const effectiveSelectedStoreIds = storeSelection.effectiveSelectedStoreIds;
  const pricingScopeStoreIds = resolvePricingScopeStoreIds({
    selectedStoreIds: effectiveSelectedStoreIds,
    identityLookup,
    env: storeIdentityEnv,
  });

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
    selectedStoreIds: pricingScopeStoreIds,
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
    equivalentStoreIdsByStoreId,
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
