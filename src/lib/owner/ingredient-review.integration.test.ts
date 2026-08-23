import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { resolveIngredientReview } from "@/lib/owner/ingredient-review-repository";
import { WEEKLY_AD_ALIAS_SOURCE } from "@/lib/weekly-ad-ingestion/weekly-ad-match-catalog";

const TEST_LABEL = "itest catalog pork loin";
const TEST_INGREDIENT_ID = "itest-pork-loin";

describe("ingredient match catalog schema (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(
      `delete from ingredient_aliases where source_name = $1 and ingredient_id like 'itest-%'`,
      [WEEKLY_AD_ALIAS_SOURCE],
    );
    await pool.query(
      `delete from ingredient_match_reviews where normalized_label like 'itest%'`,
    );
    await pool.query(
      `delete from ingredient_match_skips where normalized_label like 'itest%'`,
    );
    await pool.query(`delete from ingredients where id like 'itest-%'`);
    await resetDbPoolForTests();
  });

  it("creates skip and review tables and honors unique labels", async () => {
    const pool = getDbPool();
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in ('ingredient_match_skips', 'ingredient_match_reviews')
       order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "ingredient_match_reviews",
      "ingredient_match_skips",
    ]);

    await pool.query(
      `insert into ingredient_match_skips (normalized_label, raw_product_name, reason)
       values ($1, $2, $3)`,
      [TEST_LABEL, "Itest Catalog Pork Loin", "itest"],
    );
    await expect(
      pool.query(
        `insert into ingredient_match_skips (normalized_label, raw_product_name, reason)
         values ($1, $2, $3)`,
        [TEST_LABEL, "Itest Catalog Pork Loin", "itest"],
      ),
    ).rejects.toThrow();
  });

  it("owner yes writes a weekly-ad nickname and owner no writes a skip", async () => {
    const pool = getDbPool();
    await pool.query(
      `insert into ingredient_match_reviews (
         normalized_label, raw_product_name, chain, status
       ) values ($1, $2, 'kroger', 'pending')`,
      [TEST_LABEL, "Itest Catalog Pork Loin"],
    );

    const accepted = await resolveIngredientReview({
      normalizedLabel: TEST_LABEL,
      decision: "yes",
      ingredientId: TEST_INGREDIENT_ID,
      ingredientName: "Itest pork loin",
      category: "protein",
    });
    expect(accepted).toEqual({ ok: true, ingredientId: TEST_INGREDIENT_ID });

    const alias = await pool.query<{ ingredient_id: string }>(
      `select ingredient_id from ingredient_aliases
       where source_name = $1 and external_label = $2`,
      [WEEKLY_AD_ALIAS_SOURCE, "Itest Catalog Pork Loin"],
    );
    expect(alias.rows[0]?.ingredient_id).toBe(TEST_INGREDIENT_ID);

    await pool.query(
      `update ingredient_match_reviews
       set status = 'pending', resolved_ingredient_id = null, resolved_at = null
       where normalized_label = $1`,
      [TEST_LABEL],
    );

    const rejected = await resolveIngredientReview({
      normalizedLabel: TEST_LABEL,
      decision: "no",
    });
    expect(rejected).toEqual({ ok: true });

    const skip = await pool.query<{ reason: string }>(
      `select reason from ingredient_match_skips where normalized_label = $1`,
      [TEST_LABEL],
    );
    expect(skip.rows[0]?.reason).toBe("owner-rejected");
  });
});
