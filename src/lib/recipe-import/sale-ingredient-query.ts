import { getDbPool } from "@/lib/db";
import { MIN_WEEKLY_AD_MATCH_CONFIDENCE } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";

export type OnSaleIngredientRow = {
  ingredientId: string;
  ingredientName: string;
};

/**
 * Weekly-ad rows with an active sale label — the sale set that drives TheMealDB import.
 */
export async function getOnSaleCatalogIngredientIds(): Promise<OnSaleIngredientRow[]> {
  const pool = getDbPool();
  const result = await pool.query<{ ingredient_id: string; name: string }>(
    `
      select distinct on (po.ingredient_id)
        po.ingredient_id,
        i.name
      from price_observations po
      join ingredients i on i.id = po.ingredient_id
      where po.source_name like '%-weekly-ad-scrape'
        and po.sale_label is not null
        and (po.valid_through is null or po.valid_through >= now())
        and coalesce(po.confidence_score, 0) >= $1
      order by po.ingredient_id, po.observed_at desc
    `,
    [MIN_WEEKLY_AD_MATCH_CONFIDENCE],
  );

  return result.rows.map((row) => ({
    ingredientId: row.ingredient_id,
    ingredientName: row.name,
  }));
}

/** Ingredient IDs with an active weekly-ad sale label (for ranking eligibility). */
export async function getCurrentSaleIngredientIdSet(): Promise<Set<string>> {
  const rows = await getOnSaleCatalogIngredientIds();
  return new Set(rows.map((row) => row.ingredientId));
}
