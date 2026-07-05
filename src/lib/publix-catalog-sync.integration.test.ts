import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID,
  RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
  retirePublixAtleeBootstrapStore,
} from "@/lib/publix-catalog-sync";

describe("publix-catalog-sync (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(
      `delete from price_observations where store_id in ($1, $2)`,
      [RETIRED_PUBLIX_BOOTSTRAP_STORE_ID, PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );
    await pool.query(
      `delete from stores where id in ($1, $2)`,
      [RETIRED_PUBLIX_BOOTSTRAP_STORE_ID, PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );
    await resetDbPoolForTests();
  });

  it("migrates price observations and deletes the retired publix-atlee bootstrap row", async () => {
    const pool = getDbPool();

    await pool.query(`
      insert into stores (
        id, name, kind, city, state, latitude, longitude, source_name, source_store_id, last_verified_at
      )
      values
        ('publix-atlee', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.632, -77.348, 'yum4less-internal-catalog', 'publix-atlee', now()),
        ('publix-1626', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.610899, -77.335779, 'publix-store-locator', '1626', now())
      on conflict (id) do nothing
    `);

    await pool.query(`
      insert into price_observations (
        store_id, ingredient_id, price, in_stock, source_name, confidence_score, observed_at
      )
      values
        ('publix-atlee', 'broccoli', 2.49, true, 'publix-weekly-ad-scrape', 0.8, now()),
        ('publix-atlee', 'lemon', 0.79, true, 'publix-weekly-ad-scrape', 0.8, now()),
        ('publix-1626', 'broccoli', 2.99, true, 'publix-weekly-ad-scrape', 0.8, now())
    `);

    const result = await retirePublixAtleeBootstrapStore(PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID);

    expect(result.deletedStore).toBe(true);
    expect(result.migratedPrices).toBe(1);

    const retired = await pool.query(`select id from stores where id = $1`, [
      RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
    ]);
    expect(retired.rowCount).toBe(0);

    const prices = await pool.query<{ store_id: string; ingredient_id: string }>(
      `select store_id, ingredient_id from price_observations where ingredient_id in ('broccoli', 'lemon') order by ingredient_id`,
    );
    expect(prices.rows).toEqual([
      { store_id: "publix-1626", ingredient_id: "broccoli" },
      { store_id: "publix-1626", ingredient_id: "lemon" },
    ]);
  });

  it("is a no-op when the retired bootstrap row is already absent", async () => {
    const result = await retirePublixAtleeBootstrapStore(PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID);
    expect(result).toEqual({ migratedPrices: 0, deletedStore: false });
  });
});
