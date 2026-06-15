import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import type {
  CatalogIngredient,
  CatalogPriceObservation,
  CatalogRecipeRecord,
  CatalogStore,
} from "@/lib/market-catalog-types";
import {
  getRankedPriceSourceKind,
  RANKED_PRICE_SOURCE_SQL_FILTER,
  RANKED_PRICE_SOURCE_TIER_SQL,
} from "@/lib/price-source-policy";
import { RANKED_PRICE_CACHE_AGE_SQL_FILTER } from "@/lib/ranked-price-cache-policy";

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

const CURRENT_PRICE_OBSERVATION_SQL_FILTER =
  "(valid_through is null or valid_through >= now())";

const STORES_SQL = `
  select id, name, kind, city, state, latitude, longitude, source_name, source_store_id, last_verified_at
  from stores
  order by name
`;

const INGREDIENTS_SQL = `
  select id, name, category
  from ingredients
  order by name
`;

const RECIPES_SQL = `
  select
    id,
    title,
    summary,
    cook_time_minutes,
    difficulty,
    tags,
    dietary_tags,
    steps,
    source_name,
    source_recipe_id,
    eligible_for_ranking
  from recipes
  order by title
`;

const RECIPE_INGREDIENTS_SQL = `
  select recipe_id, ingredient_id, display_name, quantity_note, sort_order
  from recipe_ingredients
  order by recipe_id, sort_order
`;

const RANKED_PRICE_OBSERVATIONS_SQL = `
  select distinct on (store_id, ingredient_id)
    store_id,
    ingredient_id,
    price,
    sale_label,
    in_stock,
    source_name,
    confidence_score,
    observed_at,
    last_verified_at,
    valid_through,
    ${RANKED_PRICE_SOURCE_TIER_SQL} as source_tier,
    greatest(0, floor(extract(epoch from (now() - coalesce(last_verified_at, observed_at))) / 3600))::int as freshness_hours_ago,
    greatest(0, round(extract(epoch from (now() - observed_at)) / 86400))::int as freshness_days_ago
  from price_observations
  where (${RANKED_PRICE_SOURCE_SQL_FILTER})
    and ${CURRENT_PRICE_OBSERVATION_SQL_FILTER}
    and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
  order by store_id, ingredient_id, source_tier asc, coalesce(last_verified_at, observed_at) desc, confidence_score desc nulls last, observed_at desc
`;

function normalizeDietaryTags(
  tags: string[],
): Array<"vegetarian" | "vegan" | "quick"> {
  return tags.filter(
    (tag): tag is "vegetarian" | "vegan" | "quick" =>
      tag === "vegetarian" || tag === "vegan" || tag === "quick",
  );
}

function mapStoreRow(row: StoreRow): CatalogStore {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    city: row.city,
    state: row.state,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    sourceName: row.source_name ?? undefined,
    sourceStoreId: row.source_store_id ?? undefined,
    lastVerifiedAt: row.last_verified_at?.toISOString(),
  };
}

function mapPriceObservationRow(row: PriceObservationRow): CatalogPriceObservation {
  return {
    storeId: row.store_id,
    ingredientId: row.ingredient_id,
    price: Number(row.price),
    saleLabel: row.sale_label ?? undefined,
    freshnessDaysAgo: row.freshness_days_ago,
    freshnessHoursAgo: row.freshness_hours_ago,
    inStock: row.in_stock,
    priceSource: row.source_name ?? undefined,
    priceSourceKind: getRankedPriceSourceKind(row.source_name ?? undefined),
    priceSourceTier: row.source_tier,
    matchConfidence:
      row.confidence_score !== null && row.confidence_score !== undefined
        ? Number(row.confidence_score)
        : undefined,
  };
}

function buildRecipeCatalogFromRows(
  recipesResult: { rows: RecipeRow[] },
  recipeIngredientsResult: { rows: RecipeIngredientRow[] },
): CatalogRecipeRecord[] {
  const recipeIngredientsByRecipe = recipeIngredientsResult.rows.reduce(
    (map, row) => {
      const current = map.get(row.recipe_id) ?? [];
      current.push({
        ingredientId: row.ingredient_id,
        displayName: row.display_name,
        quantityNote: row.quantity_note,
      });
      map.set(row.recipe_id, current);
      return map;
    },
    new Map<string, CatalogRecipeRecord["ingredients"]>(),
  );

  return recipesResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    cookTimeMinutes: row.cook_time_minutes,
    difficulty: row.difficulty,
    tags: row.tags ?? [],
    dietaryTags: normalizeDietaryTags(row.dietary_tags ?? []),
    ingredients: recipeIngredientsByRecipe.get(row.id) ?? [],
    steps: row.steps ?? [],
    sourceName: row.source_name ?? undefined,
    sourceRecipeId: row.source_recipe_id ?? undefined,
    eligibleForRanking: row.eligible_for_ranking,
  }));
}

async function loadStores(pool: ReturnType<typeof getDbPool>) {
  const storesResult = await pool.query<StoreRow>(STORES_SQL);
  return storesResult.rows.map(mapStoreRow);
}

async function loadIngredients(pool: ReturnType<typeof getDbPool>) {
  const ingredientsResult = await pool.query<IngredientRow>(INGREDIENTS_SQL);
  return ingredientsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
  }));
}

async function loadRankedPriceObservations(pool: ReturnType<typeof getDbPool>) {
  const pricesResult = await pool.query<PriceObservationRow>(
    RANKED_PRICE_OBSERVATIONS_SQL,
  );
  return pricesResult.rows.map(mapPriceObservationRow);
}

async function loadRecipeCatalogRows(pool: ReturnType<typeof getDbPool>) {
  const [recipesResult, recipeIngredientsResult] = await Promise.all([
    pool.query<RecipeRow>(RECIPES_SQL),
    pool.query<RecipeIngredientRow>(RECIPE_INGREDIENTS_SQL),
  ]);

  return buildRecipeCatalogFromRows(recipesResult, recipeIngredientsResult);
}

export async function getMarketPricingContext(): Promise<{
  source: MarketDataSource;
} & MarketPricingContext> {
  try {
    const pool = getDbPool();
    const [stores, priceObservations] = await Promise.all([
      loadStores(pool),
      loadRankedPriceObservations(pool),
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
    const pool = getDbPool();
    const recipes = await loadRecipeCatalogRows(pool);

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
    const pool = getDbPool();

    const [pricingContext, recipeCatalog, ingredients] = await Promise.all([
      (async () => {
        const [stores, priceObservations] = await Promise.all([
          loadStores(pool),
          loadRankedPriceObservations(pool),
        ]);
        return { stores, priceObservations };
      })(),
      loadRecipeCatalogRows(pool),
      loadIngredients(pool),
    ]);

    return {
      source: "database",
      snapshot: {
        stores: pricingContext.stores,
        ingredients,
        recipes: recipeCatalog,
        priceObservations: pricingContext.priceObservations,
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
  const pool = getDbPool();
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from price_observations
      where store_id = $1
        and (${RANKED_PRICE_SOURCE_SQL_FILTER})
        and ${CURRENT_PRICE_OBSERVATION_SQL_FILTER}
        and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
    `,
    [storeId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

/** Dev-only pipeline debug: ranked observations with verification timestamps. */
export async function getRankedPriceObservationsWithTimestamps(): Promise<
  PipelinePriceObservationRow[]
> {
  const pool = getDbPool();
  const result = await pool.query<PipelinePriceObservationRow>(
    RANKED_PRICE_OBSERVATIONS_SQL,
  );
  return result.rows;
}

export type PipelinePriceObservationRow = {
  store_id: string;
  ingredient_id: string;
  price: string;
  sale_label: string | null;
  source_name: string | null;
  confidence_score: string | null;
  observed_at: Date;
  last_verified_at: Date | null;
  valid_through: Date | null;
  freshness_hours_ago: number;
  freshness_days_ago: number;
};

type StoreRow = {
  id: string;
  name: string;
  kind: CatalogStore["kind"];
  city: string;
  state: string;
  latitude: string;
  longitude: string;
  source_name: string | null;
  source_store_id: string | null;
  last_verified_at: Date | null;
};

type IngredientRow = {
  id: string;
  name: string;
  category: CatalogIngredient["category"];
};

type RecipeRow = {
  id: string;
  title: string;
  summary: string;
  cook_time_minutes: number;
  difficulty: CatalogRecipeRecord["difficulty"];
  tags: string[] | null;
  dietary_tags: string[] | null;
  steps: string[] | null;
  source_name: string | null;
  source_recipe_id: string | null;
  eligible_for_ranking: boolean;
};

type RecipeIngredientRow = {
  recipe_id: string;
  ingredient_id: string;
  display_name: string;
  quantity_note: string;
  sort_order: number;
};

type PriceObservationRow = {
  store_id: string;
  ingredient_id: string;
  price: string;
  sale_label: string | null;
  in_stock: boolean;
  source_name: string | null;
  confidence_score: string | null;
  observed_at: Date;
  last_verified_at: Date | null;
  valid_through: Date | null;
  source_tier: number;
  freshness_hours_ago: number;
  freshness_days_ago: number;
};
