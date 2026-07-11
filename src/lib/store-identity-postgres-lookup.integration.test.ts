/**
 * Option A Slice 5a — Postgres-backed StoreIdentityLookup against real DB.
 * Confirms seeds 022/023 (or equivalent confirmed rows) are readable live.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { createPostgresStoreIdentityLookup } from "@/lib/store-identity-postgres-lookup";
import {
  canonicalizeStoreId,
  expandStoreIds,
  resolveIdentity,
} from "@/lib/store-identity-resolvers";

const KROGER_SEED_SQL = readFileSync(
  join(process.cwd(), "db/init/022_seed_kroger_mechanicsville_identity.sql"),
  "utf8",
);
const ALDI_SEED_SQL = readFileSync(
  join(process.cwd(), "db/init/023_seed_aldi_mechanicsville_identity.sql"),
  "utf8",
);

describe("createPostgresStoreIdentityLookup (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(
      `delete from store_identity_aliases
       where identity_id in ('kroger-02900529', 'aldi-mechanicsville')
          or store_id in (
            'kroger-02900529', 'kroger-mechanicsville',
            'aldi-mechanicsville', 'osm-node-6531578976'
          )
          or external_id = 'osm-provisional-kroger'`,
    );
    await pool.query(
      `delete from store_identities
       where id in ('kroger-02900529', 'aldi-mechanicsville')`,
    );
    await pool.query(
      `delete from stores where id in (
         'kroger-02900529', 'osm-node-6531578976'
       )`,
    );
    await resetDbPoolForTests();
  });

  it("loads confirmed 022/023 aliases and virtual-singleton for unlinked ids", async () => {
    const pool = getDbPool();

    await pool.query(
      `insert into stores (
         id, name, kind, city, state, latitude, longitude, source_name, source_store_id
       ) values
         ('kroger-02900529', 'Kroger Marketplace - Kroger Marketplace', 'grocery',
          'Mechanicsville', 'VA', 37.61546, -77.32939, 'kroger-official-api', '02900529'),
         ('kroger-mechanicsville', 'Kroger', 'grocery',
          'Mechanicsville', 'VA', 37.6154615, -77.32939, 'kroger-weekly-ad-scrape',
          'kroger-mechanicsville'),
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

    await pool.query(KROGER_SEED_SQL);
    await pool.query(ALDI_SEED_SQL);

    // Provisional must not affect expand.
    await pool.query(
      `insert into store_identity_aliases (
         identity_id, source_system, external_id, store_id,
         member_role, link_status, match_method, match_confidence
       ) values (
         'kroger-02900529', 'openstreetmap-overpass', 'osm-provisional-kroger',
         null, 'alias', 'provisional', 'test', 0.72
       )
       on conflict (source_system, external_id) do nothing`,
    );

    const lookup = await createPostgresStoreIdentityLookup(pool);

    expect(
      expandStoreIds(lookup, ["kroger-mechanicsville"]).sort(),
    ).toEqual(["kroger-02900529", "kroger-mechanicsville"]);
    expect(canonicalizeStoreId(lookup, "kroger-mechanicsville")).toBe(
      "kroger-02900529",
    );

    expect(
      expandStoreIds(lookup, ["aldi-mechanicsville"]).sort(),
    ).toEqual(["aldi-mechanicsville", "osm-node-6531578976"]);
    expect(canonicalizeStoreId(lookup, "osm-node-6531578976")).toBe(
      "aldi-mechanicsville",
    );

    const unlinked = resolveIdentity(lookup, {
      storeId: "food-lion-mechanicsville",
    });
    expect(unlinked?.isVirtualSingleton).toBe(true);
    expect(unlinked?.memberStoreIds).toEqual(["food-lion-mechanicsville"]);

    // Provisional external id must not resolve via confirmed-only load.
    expect(
      lookup.findAliasByExternalId(
        "openstreetmap-overpass",
        "osm-provisional-kroger",
      ),
    ).toBeNull();
  });
});
