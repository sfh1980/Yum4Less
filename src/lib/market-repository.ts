import { getDbPool } from "@/lib/db";
import type {
  MockPriceObservation,
  MockRecipeRecord,
  MockStore,
} from "@/lib/mock-market-data";
import {
  getRankedPriceSourceKind,
  RANKED_PRICE_SOURCE_SQL_FILTER,
  RANKED_PRICE_SOURCE_TIER_SQL,
} from "@/lib/price-source-policy";

export type MarketDataSnapshot = {
  stores: MockStore[];
  recipes: MockRecipeRecord[];
  priceObservations: MockPriceObservation[];
};

export type MarketDataSource = "database" | "unavailable";

const EMPTY_SNAPSHOT: MarketDataSnapshot = {
  stores: [],
  recipes: [],
  priceObservations: [],
};
const CURRENT_PRICE_OBSERVATION_SQL_FILTER =
  "(valid_through is null or valid_through >= now())";

export async function getMarketDataSnapshot(): Promise<{
  snapshot: MarketDataSnapshot;
  source: MarketDataSource;
}> {
  try {
    const pool = getDbPool();

    const [storesResult, recipesResult, recipeIngredientsResult, pricesResult] =
      await Promise.all([
        pool.query<StoreRow>(`
          select id, name, kind, city, state, latitude, longitude
          from stores
          order by name
        `),
        pool.query<RecipeRow>(`
          select id, title, summary, cook_time_minutes, difficulty, tags, dietary_tags, steps
          from recipes
          order by title
        `),
        pool.query<RecipeIngredientRow>(`
          select recipe_id, ingredient_id, display_name, quantity_note, sort_order
          from recipe_ingredients
          order by recipe_id, sort_order
        `),
        pool.query<PriceObservationRow>(`
          select distinct on (store_id, ingredient_id)
            store_id,
            ingredient_id,
            price,
            sale_label,
            in_stock,
            source_name,
            confidence_score,
            ${RANKED_PRICE_SOURCE_TIER_SQL} as source_tier,
            greatest(0, floor(extract(epoch from (now() - coalesce(last_verified_at, observed_at))) / 3600))::int as freshness_hours_ago,
            greatest(0, round(extract(epoch from (now() - observed_at)) / 86400))::int as freshness_days_ago
          from price_observations
          where (${RANKED_PRICE_SOURCE_SQL_FILTER})
            and ${CURRENT_PRICE_OBSERVATION_SQL_FILTER}
          order by store_id, ingredient_id, source_tier asc, coalesce(last_verified_at, observed_at) desc, confidence_score desc nulls last, observed_at desc
        `),
      ]);

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
      new Map<string, MockRecipeRecord["ingredients"]>(),
    );

    return {
      source: "database",
      snapshot: {
        stores: storesResult.rows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          city: row.city,
          state: row.state,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        })),
        recipes: recipesResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          cookTimeMinutes: row.cook_time_minutes,
          difficulty: row.difficulty,
          tags: row.tags ?? [],
          dietaryTags: normalizeDietaryTags(row.dietary_tags ?? []),
          ingredients: recipeIngredientsByRecipe.get(row.id) ?? [],
          steps: row.steps ?? [],
        })),
        priceObservations: pricesResult.rows.map((row) => ({
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
        })),
      },
    };
  } catch {
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
    `,
    [storeId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

function normalizeDietaryTags(
  tags: string[],
): Array<"vegetarian" | "vegan" | "quick"> {
  return tags.filter(
    (tag): tag is "vegetarian" | "vegan" | "quick" =>
      tag === "vegetarian" || tag === "vegan" || tag === "quick",
  );
}

type StoreRow = {
  id: string;
  name: string;
  kind: MockStore["kind"];
  city: string;
  state: string;
  latitude: string;
  longitude: string;
};

type RecipeRow = {
  id: string;
  title: string;
  summary: string;
  cook_time_minutes: number;
  difficulty: MockRecipeRecord["difficulty"];
  tags: string[] | null;
  dietary_tags: string[] | null;
  steps: string[] | null;
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
  source_tier: number;
  freshness_hours_ago: number;
  freshness_days_ago: number;
};
