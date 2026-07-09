/**
 * Phase 2b live verification: pantry validation against DB catalog on fixture scenario.
 * Run: npx tsx scripts/.verify-pantry-phase2-fix.ts
 */
import { loadEnvLocal } from "@/lib/load-env-local";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
}

import { loadCatalogIngredients } from "@/lib/market-catalog-repository";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { getMarketSearchExperience } from "@/lib/market-search-service";
import { getPantryCoverageExperience } from "@/lib/pantry-coverage-service";
import { buildEligibleRecipePool } from "@/lib/ranking-recipe-pool";
import {
  assessRecipePoolCoverage,
  buildCatalogById,
  buildCatalogIdSet,
  buildSuggestedPantryChecklist,
  countFullyCoveredRecipes,
  filterValidPantryIngredientIds,
} from "@/lib/recipe-plan-coverage";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import { getDefaultRecipeSource } from "@/lib/recipe-sources/recipe-source-registry";
import {
  filterNearbyStoresBySelection,
  filterPriceObservationsByStoreIds,
} from "@/lib/store-scope";

const LAT = 37.6085;
const LON = -77.3739;
const ZIP = "23111";
const BUDGET = 30;

async function main() {
  const ingredientCatalog = await loadCatalogIngredients();
  const validIds = buildCatalogIdSet(ingredientCatalog);
  const catalogById = buildCatalogById(ingredientCatalog);

  const location = {
    zipCode: ZIP,
    city: "Mechanicsville",
    state: "VA",
    latitude: LAT,
    longitude: LON,
    source: "seed" as const,
  };

  const search = await getMarketSearchExperience(5, location, false);
  const market = search.market;
  const { snapshot } = await getMarketDataSnapshot();
  const storeIds = market.nearbyStores
    .filter((store) => store.recommendationEnabled)
    .map((store) => store.id);

  const preferences = {
    zipCode: ZIP,
    radiusMiles: 5,
    budget: BUDGET,
    maxIngredients: 20,
    shoppingStyle: "multi-store" as const,
    dietaryFocus: "anything" as const,
    recipeSource: getDefaultRecipeSource(),
    planningMode: "ingredient-first" as const,
    selectedStoreIds: storeIds,
    selectedIngredientIds: [] as string[],
  };

  const scopedObs = filterPriceObservationsByStoreIds(
    snapshot.priceObservations,
    storeIds,
  );
  const recStores = filterNearbyStoresBySelection(
    market.nearbyStores,
    storeIds,
  ).filter((store) => store.recommendationEnabled);

  const eligible = buildEligibleRecipePool({
    recipes: snapshot.recipes,
    preferences,
    priceObservations: scopedObs,
    selectedStoreIds: storeIds,
  });

  const beforeAssess = assessRecipePoolCoverage(eligible, {
    stores: recStores,
    observations: scopedObs,
    shoppingStyle: "multi-store",
    pantryIngredientIds: new Set(),
  });
  const suggestedIds = buildSuggestedPantryChecklist(beforeAssess, catalogById).map(
    (item) => item.ingredientId,
  );

  const validPantryIds = filterValidPantryIngredientIds(suggestedIds, validIds);
  const garbageRejected = filterValidPantryIngredientIds(
    [...validPantryIds, "not-a-real-ingredient", "sugar"],
    validIds,
  );

  const afterAssess = assessRecipePoolCoverage(eligible, {
    stores: recStores,
    observations: scopedObs,
    shoppingStyle: "multi-store",
    pantryIngredientIds: new Set(validPantryIds),
  });

  const coverageExperience = await getPantryCoverageExperience(
    {
      ...preferences,
      pantryIngredientIds: validPantryIds,
      includeIngredientCatalog: true,
    },
    location,
    false,
    { passedMarket: market },
  );

  const rankExperience = await getRecommendationExperience(
    {
      ...preferences,
      pantryIngredientIds: validPantryIds,
      latitude: LAT,
      longitude: LON,
    },
    location,
    false,
    { passedMarket: market },
  );

  console.log(
    JSON.stringify(
      {
        phase: "2b-live-verification",
        dbIngredientCount: ingredientCatalog.length,
        pantryValidation: {
          suggestedCount: suggestedIds.length,
          validPantryCount: validPantryIds.length,
          sugarAccepted: garbageRejected.includes("sugar"),
          garbageRejected: !garbageRejected.includes("not-a-real-ingredient"),
          catalogReturnedToClient: coverageExperience.ingredientCatalog?.length ?? 0,
        },
        coverage: {
          beforePantry: countFullyCoveredRecipes(beforeAssess),
          afterPantry: countFullyCoveredRecipes(afterAssess),
          serviceFullyCovered: coverageExperience.fullyCoveredRecipeCount,
          delta: countFullyCoveredRecipes(afterAssess) - countFullyCoveredRecipes(beforeAssess),
        },
        rank: {
          recommendationCount: rankExperience.recommendations.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
