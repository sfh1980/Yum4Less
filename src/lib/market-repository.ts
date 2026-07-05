import { logServerError } from "@/lib/server-log";
import type {
  CatalogIngredient,
  CatalogPriceObservation,
  CatalogRecipeRecord,
  CatalogStore,
} from "@/lib/market-catalog-types";
import {
  loadCatalogIngredients,
  loadCatalogStores,
  loadRecipeCatalog,
} from "@/lib/market-catalog-repository";
import {
  countLivePriceObservationsForStore as countLivePriceObservationsForStoreInternal,
  getRankedPriceObservationsWithTimestamps as getRankedPriceObservationsWithTimestampsInternal,
  type PipelinePriceObservationRow,
  loadRankedPriceObservations,
} from "@/lib/market-pricing-repository";

// Backward-compatible facade that composes catalog and pricing repository reads.

export type MarketDataSnapshot = {
  stores: CatalogStore[];
  ingredients: CatalogIngredient[];
  recipes: CatalogRecipeRecord[];
  priceObservations: CatalogPriceObservation[];
};

export type MarketDataSource = "database" | "unavailable";

export type MarketPricingContext = {
  stores: CatalogStore[];
  priceObservations: CatalogPriceObservation[];
};

export type RecipeCatalog = {
  recipes: CatalogRecipeRecord[];
};

const EMPTY_SNAPSHOT: MarketDataSnapshot = {
  stores: [],
  ingredients: [],
  recipes: [],
  priceObservations: [],
};

const EMPTY_PRICING_CONTEXT: MarketPricingContext = {
  stores: [],
  priceObservations: [],
};

const EMPTY_RECIPE_CATALOG: RecipeCatalog = {
  recipes: [],
};

export async function getMarketPricingContext(): Promise<{
  source: MarketDataSource;
} & MarketPricingContext> {
  try {
    const [stores, priceObservations] = await Promise.all([
      loadCatalogStores(),
      loadRankedPriceObservations(),
    ]);

    return {
      source: "database",
      stores,
      priceObservations,
    };
  } catch (error) {
    logServerError("market-repository.getMarketPricingContext", error);
    return {
      source: "unavailable",
      ...EMPTY_PRICING_CONTEXT,
    };
  }
}

export async function getRecipeCatalog(): Promise<{
  source: MarketDataSource;
} & RecipeCatalog> {
  try {
    const recipes = await loadRecipeCatalog();

    return {
      source: "database",
      recipes,
    };
  } catch (error) {
    logServerError("market-repository.getRecipeCatalog", error);
    return {
      source: "unavailable",
      ...EMPTY_RECIPE_CATALOG,
    };
  }
}

export async function getMarketDataSnapshot(): Promise<{
  snapshot: MarketDataSnapshot;
  source: MarketDataSource;
}> {
  try {
    const [stores, priceObservations, recipes, ingredients] = await Promise.all([
      loadCatalogStores(),
      loadRankedPriceObservations(),
      loadRecipeCatalog(),
      loadCatalogIngredients(),
    ]);

    return {
      source: "database",
      snapshot: {
        stores,
        ingredients,
        recipes,
        priceObservations,
      },
    };
  } catch (error) {
    logServerError("market-repository.getMarketDataSnapshot", error);
    return {
      source: "unavailable",
      snapshot: EMPTY_SNAPSHOT,
    };
  }
}

export async function countLivePriceObservationsForStore(storeId: string) {
  return countLivePriceObservationsForStoreInternal(storeId);
}

/** Dev-only pipeline debug: ranked observations with verification timestamps. */
export async function getRankedPriceObservationsWithTimestamps(): Promise<
  PipelinePriceObservationRow[]
> {
  return getRankedPriceObservationsWithTimestampsInternal();
}
