import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID,
  RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
  retireDuplicateOsmPublixNearLocatorStores,
  retirePublixAtleeBootstrapStore,
} from "@/lib/publix-catalog-sync";

const TEST_OSM_PUBLIX_DUPLICATE_STORE_ID = "osm-way-test-publix-dedupe";

/** Transient fixtures only — never leave a hole in shared `yum4less_test` CI pin. */
const TRANSIENT_STORE_IDS = [
  RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
  TEST_OSM_PUBLIX_DUPLICATE_STORE_ID,
] as const;

describe("publix-catalog-sync (integration)", () => {
  async function cleanupTransientPublixFixtures() {
    const pool = getDbPool();
    await pool.query(
      `delete from price_observations where store_id = any($1::text[])`,
      [TRANSIENT_STORE_IDS],
    );
    await pool.query(
      `delete from store_identity_aliases
       where store_id = any($1::text[]) or identity_id = any($1::text[])`,
      [TRANSIENT_STORE_IDS],
    );
    await pool.query(
      `delete from store_identities
       where id = any($1::text[]) or canonical_store_id = any($1::text[])`,
      [TRANSIENT_STORE_IDS],
    );
    await pool.query(`delete from stores where id = any($1::text[])`, [
      TRANSIENT_STORE_IDS,
    ]);
  }

  /** Re-upsert Mechanicsville Publix so e2e Settings four-chain select stays populated. */
  async function restoreCiPublixBootstrapStore() {
    const pool = getDbPool();
    await pool.query(`
      insert into stores (
        id, name, kind, city, state, latitude, longitude,
        source_name, source_store_id, last_verified_at
      )
      values (
        'publix-1626', 'Publix', 'grocery', 'Mechanicsville', 'VA',
        37.610899, -77.335779, 'yum4less-internal-catalog', '1626', now()
      )
      on conflict (id) do update set
        name = excluded.name,
        city = excluded.city,
        state = excluded.state,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        source_name = excluded.source_name,
        source_store_id = excluded.source_store_id,
        last_verified_at = excluded.last_verified_at
    `);
  }

  beforeEach(async () => {
    await cleanupTransientPublixFixtures();
    await restoreCiPublixBootstrapStore();
  });

  afterEach(async () => {
    await cleanupTransientPublixFixtures();
    await restoreCiPublixBootstrapStore();
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
      on conflict (id) do update set
        name = excluded.name,
        source_name = excluded.source_name,
        source_store_id = excluded.source_store_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude
    `);

    await pool.query(
      `delete from price_observations
       where store_id in ($1, $2) and ingredient_id in ('broccoli', 'lemon')`,
      [RETIRED_PUBLIX_BOOTSTRAP_STORE_ID, PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );

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
    expect(result.migratedPrices).toBe(2);

    const retired = await pool.query(`select id from stores where id = $1`, [
      RETIRED_PUBLIX_BOOTSTRAP_STORE_ID,
    ]);
    expect(retired.rowCount).toBe(0);

    const prices = await pool.query<{ store_id: string; ingredient_id: string }>(
      `select store_id, ingredient_id from price_observations where store_id = $1 and ingredient_id in ('broccoli', 'lemon') order by ingredient_id`,
      [PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
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

  it("retires duplicate Publix OSM pins near locator stores and migrates prices", async () => {
    const pool = getDbPool();

    await pool.query(
      `delete from price_observations where store_id in ($1, $2)`,
      [TEST_OSM_PUBLIX_DUPLICATE_STORE_ID, PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );
    await pool.query(
      `delete from store_identity_aliases
       where store_id in ($1, $2) or identity_id in ($1, $2)`,
      [TEST_OSM_PUBLIX_DUPLICATE_STORE_ID, PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );
    await pool.query(
      `delete from store_identities where id in ($1, $2) or canonical_store_id in ($1, $2)`,
      [TEST_OSM_PUBLIX_DUPLICATE_STORE_ID, PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );
    await pool.query(`delete from stores where id = $1`, [
      TEST_OSM_PUBLIX_DUPLICATE_STORE_ID,
    ]);

    await pool.query(`
      insert into stores (
        id, name, kind, city, state, latitude, longitude, source_name, source_store_id, last_verified_at
      )
      values
        ('${TEST_OSM_PUBLIX_DUPLICATE_STORE_ID}', 'Publix', 'grocery', 'Mechanicsville', 'VA', 37.610845, -77.335685, 'openstreetmap-overpass', '789560637', now()),
        ('publix-1626', 'Brandy Creek Commons', 'grocery', 'Mechanicsville', 'VA', 37.610899, -77.335779, 'publix-store-locator', '1626', now())
      on conflict (id) do update set
        name = excluded.name,
        source_name = excluded.source_name,
        source_store_id = excluded.source_store_id,
        latitude = excluded.latitude,
        longitude = excluded.longitude
    `);

    await pool.query(`
      insert into price_observations (
        store_id, ingredient_id, price, in_stock, source_name, confidence_score, observed_at
      )
      values
        ('${TEST_OSM_PUBLIX_DUPLICATE_STORE_ID}', 'broccoli', 2.49, true, 'publix-weekly-ad-scrape', 0.8, now()),
        ('${TEST_OSM_PUBLIX_DUPLICATE_STORE_ID}', 'lemon', 0.79, true, 'publix-weekly-ad-scrape', 0.8, now()),
        ('publix-1626', 'broccoli', 2.99, true, 'publix-weekly-ad-scrape', 0.8, now())
    `);

    const result = await retireDuplicateOsmPublixNearLocatorStores();

    expect(result.deletedStoreIds).toEqual([TEST_OSM_PUBLIX_DUPLICATE_STORE_ID]);
    expect(result.migratedPrices).toBe(2);

    const retired = await pool.query(`select id from stores where id = $1`, [
      TEST_OSM_PUBLIX_DUPLICATE_STORE_ID,
    ]);
    expect(retired.rowCount).toBe(0);

    const prices = await pool.query<{ store_id: string; ingredient_id: string }>(
      `select store_id, ingredient_id from price_observations where store_id = $1 and ingredient_id in ('broccoli', 'lemon') order by ingredient_id`,
      [PUBLIX_MECHANICSVILLE_BOOTSTRAP_STORE_ID],
    );
    expect(prices.rows).toEqual([
      { store_id: "publix-1626", ingredient_id: "broccoli" },
      { store_id: "publix-1626", ingredient_id: "lemon" },
    ]);
  });
});
