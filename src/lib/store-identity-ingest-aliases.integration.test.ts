/**
 * Option A Slice 5c — integration tests for ingest alias writes (real Postgres).
 *
 * Covers the eight locked cases: idempotency, self-alias, explicit-pointer,
 * negative-no-proximity, negative-bad-pointer, collision, Kroger-non-link,
 * rollback.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  ensureAllowlistedPointerCrossLink,
  ensureCatalogStoreIdentityAliases,
  ensureStoreSelfAlias,
} from "@/lib/store-identity-ingest-aliases";
import { createPostgresStoreIdentityLookup } from "@/lib/store-identity-postgres-lookup";
import { expandStoreIdsForRead } from "@/lib/store-identity-resolvers";
import { upsertCatalogStores } from "@/lib/store-catalog-sync";

/** OSM ids must match isOsmStorePointerTargetId; avoid Mechanicsville production id. */
const IDS = {
  osm: "osm-node-9001112221",
  osmNear: "osm-node-9001112222",
  aldi: "aldi-si5c-catalog",
  aldiB: "aldi-si5c-near",
  krogerApi: "kroger-si5c-02900991",
  krogerSlug: "kroger-si5c-slug",
  other: "kroger-si5c-other",
} as const;

const ALL_STORE_IDS = Object.values(IDS);

async function cleanup() {
  const pool = getDbPool();
  await pool.query(
    `delete from store_identity_aliases
     where store_id = any($1::text[])
        or identity_id = any($1::text[])
        or external_id = any($1::text[])
        or external_id = '02900991'`,
    [ALL_STORE_IDS],
  );
  await pool.query(`delete from store_identities where id = any($1::text[])`, [
    ALL_STORE_IDS,
  ]);
  await pool.query(`delete from stores where id = any($1::text[])`, [
    ALL_STORE_IDS,
  ]);
  await resetDbPoolForTests();
}

async function insertStore(input: {
  id: string;
  name: string;
  sourceName: string;
  sourceStoreId: string;
  latitude?: number;
  longitude?: number;
}) {
  const pool = getDbPool();
  await pool.query(
    `
      insert into stores (
        id, name, kind, city, state, latitude, longitude,
        source_name, source_store_id, last_verified_at
      )
      values ($1, $2, 'grocery', 'Mechanicsville', 'VA', $3, $4, $5, $6, now())
    `,
    [
      input.id,
      input.name,
      input.latitude ?? 37.6085,
      input.longitude ?? -77.3739,
      input.sourceName,
      input.sourceStoreId,
    ],
  );
}

describe("store-identity ingest aliases (Slice 5c integration)", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("self-alias: store upsert creates/maintains own confirmed self-alias", async () => {
    const pool = getDbPool();
    await insertStore({
      id: IDS.osm,
      name: "Aldi",
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });

    const first = await ensureStoreSelfAlias({
      storeId: IDS.osm,
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
      name: "Aldi",
    });
    expect(first.aliasesEnsured).toBe(1);
    expect(first.aliasConflicts).toBe(0);

    const row = await pool.query<{
      match_method: string;
      match_confidence: string;
      link_status: string;
      member_role: string;
    }>(
      `
        select match_method, match_confidence::text, link_status, member_role
        from store_identity_aliases
        where store_id = $1
      `,
      [IDS.osm],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({
      match_method: "self",
      match_confidence: "1.0000",
      link_status: "confirmed",
      member_role: "canonical",
    });
  });

  it("idempotency: re-running the same ensure does not duplicate or corrupt aliases", async () => {
    await insertStore({
      id: IDS.osm,
      name: "Aldi",
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });

    const first = await ensureCatalogStoreIdentityAliases({
      storeId: IDS.osm,
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });
    const second = await ensureCatalogStoreIdentityAliases({
      storeId: IDS.osm,
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });

    expect(first.aliasesEnsured).toBe(1);
    expect(second.aliasesEnsured).toBe(0);
    expect(second.aliasesSkipped).toBeGreaterThan(0);
    expect(second.aliasConflicts).toBe(0);

    const pool = getDbPool();
    const aliases = await pool.query(
      `select * from store_identity_aliases where store_id = $1`,
      [IDS.osm],
    );
    expect(aliases.rowCount).toBe(1);
  });

  it("explicit-pointer: Aldi source_store_id → existing OSM creates confirmed pointer link (confidence 1.0)", async () => {
    const pool = getDbPool();
    await insertStore({
      id: IDS.osm,
      name: "Aldi",
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });
    await insertStore({
      id: IDS.aldi,
      name: "Aldi",
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
      latitude: 37.6085,
      longitude: -77.3739,
    });

    await ensureStoreSelfAlias({
      storeId: IDS.osm,
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });

    const stats = await ensureAllowlistedPointerCrossLink({
      storeId: IDS.aldi,
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
      name: "Aldi",
    });
    expect(stats.aliasConflicts).toBe(0);
    expect(stats.aliasesEnsured).toBeGreaterThanOrEqual(1);

    const aliases = await pool.query<{
      store_id: string;
      member_role: string;
      match_method: string;
      match_confidence: string;
      identity_id: string;
    }>(
      `
        select store_id, member_role, match_method, match_confidence::text, identity_id
        from store_identity_aliases
        where identity_id = $1
        order by member_role desc, store_id
      `,
      [IDS.aldi],
    );

    expect(aliases.rows.map((r) => r.store_id).sort()).toEqual(
      [IDS.aldi, IDS.osm].sort(),
    );
    const osmAlias = aliases.rows.find((r) => r.store_id === IDS.osm);
    expect(osmAlias).toMatchObject({
      member_role: "alias",
      match_method: "pointer",
      match_confidence: "1.0000",
    });
    const catalogAlias = aliases.rows.find((r) => r.store_id === IDS.aldi);
    expect(catalogAlias?.member_role).toBe("canonical");
  });

  it("negative-no-proximity: nearby same-chain stores without pointer are not auto-linked", async () => {
    const pool = getDbPool();
    await insertStore({
      id: IDS.aldi,
      name: "Aldi",
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.aldi,
      latitude: 37.6085,
      longitude: -77.3739,
    });
    await insertStore({
      id: IDS.aldiB,
      name: "Aldi",
      sourceName: "yum4less-market-catalog",
      sourceStoreId: IDS.aldiB,
      latitude: 37.6086,
      longitude: -77.374,
    });

    await ensureCatalogStoreIdentityAliases({
      storeId: IDS.aldi,
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.aldi,
    });
    await ensureCatalogStoreIdentityAliases({
      storeId: IDS.aldiB,
      sourceName: "yum4less-market-catalog",
      sourceStoreId: IDS.aldiB,
    });

    const linked = await pool.query(
      `
        select a.identity_id
        from store_identity_aliases a
        join store_identity_aliases b on a.identity_id = b.identity_id
        where a.store_id = $1 and b.store_id = $2
      `,
      [IDS.aldi, IDS.aldiB],
    );
    expect(linked.rowCount).toBe(0);

    const identities = await pool.query(
      `select id from store_identities where id in ($1, $2)`,
      [IDS.aldi, IDS.aldiB],
    );
    expect(identities.rowCount).toBe(2);
  });

  it("negative-bad-pointer: unreliable source_store_id does not create a cross-store alias", async () => {
    const pool = getDbPool();
    await insertStore({
      id: IDS.other,
      name: "Kroger",
      sourceName: "kroger-official-api",
      sourceStoreId: "99999",
    });
    await insertStore({
      id: IDS.aldi,
      name: "Aldi",
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.other,
    });

    const stats = await ensureAllowlistedPointerCrossLink({
      storeId: IDS.aldi,
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.other,
    });
    expect(stats.aliasesEnsured).toBe(0);

    const cross = await pool.query(
      `
        select * from store_identity_aliases
        where store_id = $1
           or (identity_id = $2 and store_id is distinct from $2)
      `,
      [IDS.other, IDS.aldi],
    );
    expect(cross.rowCount).toBe(0);
  });

  it("collision: conflicting binding logs and skips without overwriting existing row", async () => {
    const pool = getDbPool();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await insertStore({
      id: IDS.osm,
      name: "Aldi",
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });
    await insertStore({
      id: IDS.aldi,
      name: "Aldi",
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
    });
    await insertStore({
      id: IDS.aldiB,
      name: "Aldi Other",
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
    });

    await pool.query(
      `insert into store_identities (id, canonical_store_id, display_name)
       values ($1, $1, 'Aldi Other')`,
      [IDS.aldiB],
    );
    await pool.query(
      `
        insert into store_identity_aliases (
          identity_id, source_system, external_id, store_id,
          member_role, link_status, match_method, match_confidence
        ) values
          ($1, 'aldi-weekly-ad-scrape', $1, $1, 'canonical', 'confirmed', 'seeded', 0.985),
          ($1, 'openstreetmap-overpass', $2, $2, 'alias', 'confirmed', 'seeded', 0.985)
      `,
      [IDS.aldiB, IDS.osm],
    );

    const before = await pool.query(
      `select identity_id, match_method from store_identity_aliases where store_id = $1`,
      [IDS.osm],
    );
    expect(before.rows[0]?.identity_id).toBe(IDS.aldiB);
    expect(before.rows[0]?.match_method).toBe("seeded");

    const stats = await ensureAllowlistedPointerCrossLink({
      storeId: IDS.aldi,
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
    });
    expect(stats.aliasConflicts).toBeGreaterThanOrEqual(1);

    const after = await pool.query(
      `select identity_id, match_method from store_identity_aliases where store_id = $1`,
      [IDS.osm],
    );
    expect(after.rows[0]?.identity_id).toBe(IDS.aldiB);
    expect(after.rows[0]?.match_method).toBe("seeded");
    // Conflicting pointer must not attach OSM under the attempting catalog identity.
    const stolen = await pool.query(
      `select 1 from store_identity_aliases where identity_id = $1 and store_id = $2`,
      [IDS.aldi, IDS.osm],
    );
    expect(stolen.rowCount).toBe(0);

    const loggedConflict = errorSpy.mock.calls.some((call) =>
      String(call[0]).includes("store-identity.ingest-alias-conflict"),
    );
    expect(loggedConflict).toBe(true);
    errorSpy.mockRestore();
  });

  it("Kroger-non-link: slug and API self-aliases stay unlinked by ingest", async () => {
    const pool = getDbPool();
    await insertStore({
      id: IDS.krogerApi,
      name: "Kroger",
      sourceName: "kroger-official-api",
      sourceStoreId: "02900991",
      latitude: 37.615,
      longitude: -77.329,
    });
    await insertStore({
      id: IDS.krogerSlug,
      name: "Kroger",
      sourceName: "kroger-weekly-ad-scrape",
      sourceStoreId: IDS.krogerSlug,
      latitude: 37.615,
      longitude: -77.329,
    });

    await ensureCatalogStoreIdentityAliases({
      storeId: IDS.krogerApi,
      sourceName: "kroger-official-api",
      sourceStoreId: "02900991",
    });
    await ensureCatalogStoreIdentityAliases({
      storeId: IDS.krogerSlug,
      sourceName: "kroger-weekly-ad-scrape",
      sourceStoreId: IDS.krogerSlug,
    });

    const shared = await pool.query(
      `
        select a.identity_id
        from store_identity_aliases a
        join store_identity_aliases b on a.identity_id = b.identity_id
        where a.store_id = $1 and b.store_id = $2
      `,
      [IDS.krogerApi, IDS.krogerSlug],
    );
    expect(shared.rowCount).toBe(0);

    const apiKeys = await pool.query(
      `
        select source_system, external_id, match_method
        from store_identity_aliases where store_id = $1
      `,
      [IDS.krogerApi],
    );
    expect(apiKeys.rows[0]).toMatchObject({
      source_system: "kroger-official-api",
      external_id: "02900991",
      match_method: "self",
    });
  });

  it("rollback: rejected link_status drops peer from confirmed lookup without deleting rows", async () => {
    const pool = getDbPool();
    await insertStore({
      id: IDS.osm,
      name: "Aldi",
      sourceName: "openstreetmap-overpass",
      sourceStoreId: IDS.osm,
    });
    await insertStore({
      id: IDS.aldi,
      name: "Aldi",
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
    });

    await ensureCatalogStoreIdentityAliases({
      storeId: IDS.aldi,
      sourceName: "aldi-weekly-ad-scrape",
      sourceStoreId: IDS.osm,
      name: "Aldi",
    });

    await pool.query(
      `
        update store_identity_aliases
        set link_status = 'rejected'
        where store_id = $1 and match_method = 'pointer'
      `,
      [IDS.osm],
    );

    const lookup = await createPostgresStoreIdentityLookup(pool);
    const expanded = expandStoreIdsForRead(lookup, [IDS.aldi], {
      YUM4LESS_STORE_IDENTITY_EXPAND: "1",
    });
    expect(expanded).toEqual([IDS.aldi]);

    const stillThere = await pool.query(
      `select link_status from store_identity_aliases where store_id = $1`,
      [IDS.osm],
    );
    expect(stillThere.rows[0]?.link_status).toBe("rejected");
  });

  it("upsertCatalogStores hooks self-alias after successful write", async () => {
    const pool = getDbPool();
    await upsertCatalogStores([
      {
        id: IDS.osmNear,
        name: "Food Lion",
        kind: "grocery",
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.61,
        longitude: -77.37,
        sourceName: "openstreetmap-overpass",
        sourceStoreId: IDS.osmNear,
      },
    ]);

    const alias = await pool.query(
      `
        select match_method, link_status from store_identity_aliases
        where store_id = $1
      `,
      [IDS.osmNear],
    );
    expect(alias.rows[0]).toMatchObject({
      match_method: "self",
      link_status: "confirmed",
    });
  });
});
