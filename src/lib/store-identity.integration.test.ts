import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";

/**
 * Slice 1 item N: store_identities / store_identity_aliases exist and
 * UNIQUE constraints reject duplicates.
 */
describe("store identity schema (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(`delete from store_identity_aliases`);
    await pool.query(`delete from store_identities`);
    await pool.query(
      `delete from stores where id in ('si-itest-canonical', 'si-itest-alias', 'si-itest-other')`,
    );
    await resetDbPoolForTests();
  });

  it("enforces unique (source_system, external_id), store_id, snap, and one canonical", async () => {
    const pool = getDbPool();

    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in ('store_identities', 'store_identity_aliases')
       order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "store_identities",
      "store_identity_aliases",
    ]);

    await pool.query(
      `insert into stores (id, name, kind, city, state, latitude, longitude, source_name, source_store_id)
       values
         ('si-itest-canonical', 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-official-api', '02900999'),
         ('si-itest-alias', 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-weekly-ad-scrape', 'si-itest-alias'),
         ('si-itest-other', 'Kroger', 'grocery', 'Mechanicsville', 'VA', 37.62, -77.33, 'kroger-official-api', '02900998')`,
    );

    await pool.query(
      `insert into store_identities (id, canonical_store_id, display_name)
       values ('si-itest-canonical', 'si-itest-canonical', 'Kroger')`,
    );

    await pool.query(
      `insert into store_identity_aliases
         (identity_id, source_system, external_id, store_id, member_role, link_status, match_method, match_confidence)
       values
         ('si-itest-canonical', 'kroger-official-api', '02900999', 'si-itest-canonical', 'canonical', 'confirmed', 'test', 0.99),
         ('si-itest-canonical', 'kroger-weekly-ad-scrape', 'si-itest-alias', 'si-itest-alias', 'alias', 'confirmed', 'test', 0.95)`,
    );

    await expect(
      pool.query(
        `insert into store_identity_aliases
           (identity_id, source_system, external_id, store_id, member_role, link_status)
         values ('si-itest-canonical', 'kroger-official-api', '02900999', 'si-itest-other', 'alias', 'confirmed')`,
      ),
    ).rejects.toThrow(/store_identity_aliases_source_external_uid|unique/i);

    await expect(
      pool.query(
        `insert into store_identity_aliases
           (identity_id, source_system, external_id, store_id, member_role, link_status)
         values ('si-itest-canonical', 'openstreetmap-overpass', 'osm-dup', 'si-itest-alias', 'alias', 'confirmed')`,
      ),
    ).rejects.toThrow(/store_identity_aliases_store_id_uidx|unique/i);

    await expect(
      pool.query(
        `insert into store_identity_aliases
           (identity_id, source_system, external_id, store_id, member_role, link_status)
         values ('si-itest-canonical', 'kroger-official-api', '02900998', 'si-itest-other', 'canonical', 'confirmed')`,
      ),
    ).rejects.toThrow(/store_identity_aliases_one_canonical_uidx|unique/i);

    await expect(
      pool.query(
        `insert into store_identities (id, canonical_store_id)
         values ('si-itest-mismatch', 'si-itest-other')`,
      ),
    ).rejects.toThrow(/store_identities_id_matches_canonical|check/i);
  });
});
