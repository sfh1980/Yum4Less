import { getDbPool } from "@/lib/db";
import { boundingBoxForRadiusMiles, getDistanceMiles } from "@/lib/geo-distance";
import type {
  CatalogIngredient,
  CatalogRecipeRecord,
  CatalogStore,
} from "@/lib/market-catalog-types";

// Catalog-only reads: stores, ingredients, recipes, and recipe ingredients.

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

export async function loadCatalogStores(): Promise<CatalogStore[]> {
  const storesResult = await getDbPool().query<StoreRow>(STORES_SQL);
  return storesResult.rows.map(mapStoreRow);
}

export async function listCatalogStoresNearLocation(input: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
}): Promise<CatalogStore[]> {
  const box = boundingBoxForRadiusMiles(
    input.latitude,
    input.longitude,
    input.radiusMiles,
  );
  const storesResult = await getDbPool().query<StoreRow>(STORES_NEAR_SQL, [
    box.minLatitude,
    box.maxLatitude,
    box.minLongitude,
    box.maxLongitude,
  ]);

  return storesResult.rows
    .map(mapStoreRow)
    .filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
    .filter(
      (store) =>
        getDistanceMiles(
          input.latitude,
          input.longitude,
          store.latitude,
          store.longitude,
        ) <= input.radiusMiles,
    );
}

const STORES_NEAR_SQL = `
  select id, name, kind, city, state, latitude, longitude, source_name, source_store_id, last_verified_at
  from stores
  where latitude between $1 and $2
    and longitude between $3 and $4
    and id not like 'fixture-osm-%'
`;


export async function loadCatalogIngredients(): Promise<CatalogIngredient[]> {
  const ingredientsResult = await getDbPool().query<IngredientRow>(INGREDIENTS_SQL);
  return ingredientsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
  }));
}

export async function loadRecipeCatalog(): Promise<CatalogRecipeRecord[]> {
  const [recipesResult, recipeIngredientsResult] = await Promise.all([
    getDbPool().query<RecipeRow>(RECIPES_SQL),
    getDbPool().query<RecipeIngredientRow>(RECIPE_INGREDIENTS_SQL),
  ]);

  return buildRecipeCatalogFromRows(recipesResult.rows, recipeIngredientsResult.rows);
}

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

function buildRecipeCatalogFromRows(
  recipeRows: RecipeRow[],
  recipeIngredientRows: RecipeIngredientRow[],
): CatalogRecipeRecord[] {
  const recipeIngredientsByRecipe = recipeIngredientRows.reduce(
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

  return recipeRows.map((row) => ({
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
