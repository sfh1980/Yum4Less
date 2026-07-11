import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";

const SEED_PATH = join(
  process.cwd(),
  "db/init/023_seed_aldi_mechanicsville_identity.sql",
);
const SEED_SQL = readFileSync(SEED_PATH, "utf8");

/**
 * T4: migration 023 seeds Aldi↔OSM identity idempotently when both member
 * store rows already exist — and never inserts stores rows.
 */
describe("store identity Aldi/OSM seed migration 023 (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(
      `delete from store_identity_aliases
       where identity_id = 'aldi-mechanicsville'
          or store_id in ('aldi-mechanicsville', 'osm-node-6531578976')`,
    );
    await pool.query(
      `delete from store_identities where id = 'aldi-mechanicsville'`,
    );
    // OSM node is not CI-bootstrap; safe to remove. Keep aldi-mechanicsville
    // (present in db/ci/014) so later suites still see the catalog slug.
    await pool.query(`delete from stores where id = 'osm-node-6531578976'`);
    await resetDbPoolForTests();
  });

  it("T4: SQL is link-only (no insert into stores)", () => {
    expect(SEED_SQL.toLowerCase()).not.toMatch(/insert\s+into\s+stores\b/);
  });

  it("T4: re-applying 023 yields one identity and two aliases (idempotent)", async () => {
    const pool = getDbPool();

    await pool.query(
      `insert into stores (
         id, name, kind, city, state, latitude, longitude, source_name, source_store_id
       ) values
         ('aldi-mechanicsville', 'Aldi', 'grocery',
          'Mechanicsville', 'VA', 37.611004, -77.336853, 'aldi-weekly-ad-scrape',
          'osm-node-6531578976'),
         ('osm-node-6531578976', 'ALDI', 'grocery',
          'Mechanicsville', 'VA', 37.611004, -77.336853, 'openstreetmap-overpass',
          'osm-node-6531578976')
       on conflict (id) do update set
         source_name = excluded.source_name,
         source_store_id = excluded.source_store_id,
         latitude = excluded.latitude,
         longitude = excluded.longitude`,
    );

    const storesBefore = await pool.query<{ count: string }>(
      `select count(*)::text as count from stores
       where id in ('aldi-mechanicsville', 'osm-node-6531578976')`,
    );
    expect(Number(storesBefore.rows[0]?.count)).toBe(2);

    await pool.query(SEED_SQL);
    await pool.query(SEED_SQL);

    const storesAfter = await pool.query<{ count: string }>(
      `select count(*)::text as count from stores
       where id in ('aldi-mechanicsville', 'osm-node-6531578976')`,
    );
    expect(Number(storesAfter.rows[0]?.count)).toBe(2);

    const identities = await pool.query<{ id: string; canonical_store_id: string }>(
      `select id, canonical_store_id from store_identities where id = 'aldi-mechanicsville'`,
    );
    expect(identities.rows).toHaveLength(1);
    expect(identities.rows[0]?.canonical_store_id).toBe("aldi-mechanicsville");

    const aliases = await pool.query<{
      store_id: string;
      member_role: string;
      link_status: string;
      match_method: string;
      match_confidence: string;
    }>(
      `select store_id, member_role, link_status, match_method, match_confidence::text
       from store_identity_aliases
       where identity_id = 'aldi-mechanicsville'
       order by member_role desc, store_id`,
    );
    expect(aliases.rows).toHaveLength(2);
    expect(aliases.rows.map((row) => row.store_id).sort()).toEqual([
      "aldi-mechanicsville",
      "osm-node-6531578976",
    ]);
    expect(aliases.rows.every((row) => row.link_status === "confirmed")).toBe(
      true,
    );
    expect(aliases.rows.every((row) => row.match_method === "seeded")).toBe(
      true,
    );
    expect(
      aliases.rows.every((row) => Number(row.match_confidence) === 0.985),
    ).toBe(true);
    expect(
      aliases.rows.find((row) => row.member_role === "canonical")?.store_id,
    ).toBe("aldi-mechanicsville");
    expect(
      aliases.rows.find((row) => row.member_role === "alias")?.store_id,
    ).toBe("osm-node-6531578976");
  });

  it("T4: does not insert identity when only one member store exists", async () => {
    const pool = getDbPool();

    await pool.query(
      `insert into stores (
         id, name, kind, city, state, latitude, longitude, source_name, source_store_id
       ) values
         ('aldi-mechanicsville', 'Aldi', 'grocery',
          'Mechanicsville', 'VA', 37.611004, -77.336853, 'aldi-weekly-ad-scrape',
          'osm-node-6531578976')
       on conflict (id) do update set
         source_name = excluded.source_name,
         source_store_id = excluded.source_store_id`,
    );
    await pool.query(`delete from stores where id = 'osm-node-6531578976'`);

    await pool.query(SEED_SQL);

    const identities = await pool.query(
      `select 1 from store_identities where id = 'aldi-mechanicsville'`,
    );
    expect(identities.rows).toHaveLength(0);

    const osmInserted = await pool.query(
      `select 1 from stores where id = 'osm-node-6531578976'`,
    );
    expect(osmInserted.rows).toHaveLength(0);
  });
});
