import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import {
  buildOsmCatalogStore,
  isMapContextOnlyCatalogSource,
  refreshBootstrapRankedStoreCoordinates,
  syncUniversalMapCatalogForZip,
  syncV1ChainStoresToCatalog,
} from "@/lib/store-catalog-sync";
import { fixtureOsmFoodRetailStores23111 } from "@/lib/fixtures/osm-food-retail.fixtures";

describe("store catalog sync (integration)", () => {
  beforeEach(async () => {
    const pool = getDbPool();
    await pool.query(`delete from stores where id like 'osm-%'`);
    await pool.query(
      `delete from stores where source_name = 'kroger-official-api' and id <> 'kroger-mechanicsville'`,
    );
    await pool.query(`
      update stores
      set
        latitude = 37.615300,
        longitude = -77.349100,
        source_name = 'yum4less-internal-catalog',
        source_store_id = 'kroger-mechanicsville',
        name = 'Kroger',
        last_verified_at = now()
      where id = 'kroger-mechanicsville'
    `);
  });

  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(`
      update stores
      set
        latitude = 37.615300,
        longitude = -77.349100,
        source_name = 'yum4less-internal-catalog',
        source_store_id = 'kroger-mechanicsville',
        name = 'Kroger',
        last_verified_at = now()
      where id = 'kroger-mechanicsville'
    `);
    await pool.query(`delete from stores where id like 'osm-%'`);
    await pool.query(
      `delete from stores where source_name = 'kroger-official-api' and id <> 'kroger-mechanicsville'`,
    );
    await pool.query(
      `delete from stores where source_name = 'yum4less-market-catalog' and id <> 'aldi-mechanicsville'`,
    );
    await resetDbPoolForTests();
  });

  it("upserts OSM map-context stores without overwriting seeded ranked rows", async () => {
    const before = await getMarketDataSnapshot();
    const seededKroger = before.snapshot.stores.find(
      (store) => store.id === "kroger-mechanicsville",
    );
    expect(seededKroger).toBeDefined();

    const result = await syncUniversalMapCatalogForZip({
      zipCode: "23111",
      useFixture: true,
    });

    expect(result.osmUpserted).toBeGreaterThan(0);

    const after = await getMarketDataSnapshot();
    expect(after.snapshot.stores.length).toBeGreaterThan(before.snapshot.stores.length);
    expect(
      after.snapshot.stores.some((store) => store.id.startsWith("osm-")),
    ).toBe(true);
    expect(
      after.snapshot.stores.some((store) => store.id === "kroger-mechanicsville"),
    ).toBe(true);

    const pool = getDbPool();
    const osmSourceRows = await pool.query<{ id: string; source_name: string | null }>(
      `select id, source_name from stores where id like 'osm-%'`,
    );
    expect(osmSourceRows.rows.length).toBeGreaterThan(0);
    expect(
      osmSourceRows.rows.every((row) => row.source_name === "openstreetmap-overpass"),
    ).toBe(true);
  });

  it("is idempotent when the same OSM fixture rows are ingested twice", async () => {
    await syncUniversalMapCatalogForZip({ zipCode: "23111", useFixture: true });
    const firstCount = (await getMarketDataSnapshot()).snapshot.stores.length;

    const second = await syncUniversalMapCatalogForZip({
      zipCode: "23111",
      useFixture: true,
    });
    const secondCount = (await getMarketDataSnapshot()).snapshot.stores.length;

    expect(second.osmUpserted).toBeGreaterThan(0);
    expect(secondCount).toBe(firstCount);
  });

  it("marks ingested OSM rows as map-context catalog sources in Postgres", async () => {
    const sample = buildOsmCatalogStore(fixtureOsmFoodRetailStores23111[0]!);
    expect(isMapContextOnlyCatalogSource(sample.sourceName)).toBe(true);
  });

  it("overwrites linked Kroger coordinates when provider discovery matches source_store_id", async () => {
    const pool = getDbPool();
    await pool.query(`
      update stores
      set
        source_store_id = '02900529',
        latitude = 37.615300,
        longitude = -77.349100,
        source_name = 'yum4less-internal-catalog',
        name = 'Kroger',
        last_verified_at = now()
      where id = 'kroger-mechanicsville'
    `);
    const before = await pool.query<{
      latitude: string;
      longitude: string;
      source_name: string | null;
    }>(`
      select latitude, longitude, source_name
      from stores
      where id = 'kroger-mechanicsville'
    `);

    const updated = await refreshBootstrapRankedStoreCoordinates({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "geocodio",
        zipCode: "23111",
      },
      zipCode: "23111",
      providerStoreSearches: [
        {
          provider: "kroger",
          label: "Kroger",
          configured: true,
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          fallbackUsed: false,
          message: "Fixture Kroger discovery for bootstrap refresh test.",
          fetchedAt: new Date().toISOString(),
          stores: [
            {
              provider: "kroger",
              providerStoreId: "02900529",
              name: "Kroger",
              city: "Mechanicsville",
              state: "VA",
              latitude: 37.701,
              longitude: -77.401,
            },
          ],
        },
      ],
    });

    expect(updated).toBeGreaterThan(0);

    const after = await pool.query<{
      latitude: string;
      longitude: string;
      source_name: string | null;
    }>(`
      select latitude, longitude, source_name
      from stores
      where id = 'kroger-mechanicsville'
    `);

    expect(Number(after.rows[0]?.latitude)).toBeCloseTo(37.701, 2);
    expect(Number(after.rows[0]?.longitude)).toBeCloseTo(-77.401, 2);
    expect(after.rows[0]?.source_name).toBe("kroger-official-api");
    expect(Number(before.rows[0]?.latitude)).toBeCloseTo(37.6153, 3);
  });

  it("refreshes Kroger coordinates when weekly-ad ingest already set source_name", async () => {
    const pool = getDbPool();
    await pool.query(`
      update stores
      set
        source_name = 'kroger-weekly-ad-scrape',
        source_store_id = '02900529',
        last_verified_at = now()
      where id = 'kroger-mechanicsville'
    `);

    const updated = await refreshBootstrapRankedStoreCoordinates({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "geocodio",
        zipCode: "23111",
      },
      zipCode: "23111",
      providerStoreSearches: [
        {
          provider: "kroger",
          label: "Kroger",
          configured: true,
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          fallbackUsed: false,
          message: "Fixture Kroger discovery after weekly-ad ingest.",
          fetchedAt: new Date().toISOString(),
          stores: [
            {
              provider: "kroger",
              providerStoreId: "02900529",
              name: "Kroger",
              city: "Mechanicsville",
              state: "VA",
              latitude: 37.701,
              longitude: -77.401,
            },
          ],
        },
      ],
    });

    expect(updated).toBeGreaterThan(0);

    const after = await pool.query<{
      latitude: string;
      longitude: string;
      source_name: string | null;
    }>(`
      select latitude, longitude, source_name
      from stores
      where id = 'kroger-mechanicsville'
    `);

    expect(Number(after.rows[0]?.latitude)).toBeCloseTo(37.701, 2);
    expect(after.rows[0]?.source_name).toBe("kroger-official-api");
  });

  it("upserts Aldi from nearest OSM during ranked catalog sync without ZIP-centroid fallback", async () => {
    const pool = getDbPool();

    const merged = await syncV1ChainStoresToCatalog({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.628179,
        longitude: -77.281955,
        source: "geocodio",
        zipCode: "23111",
      },
      zipCode: "23111",
      providerStoreSearches: [],
      osmFoodRetailStores: fixtureOsmFoodRetailStores23111,
    });

    expect(merged).toBeGreaterThan(0);

    const after = await pool.query<{
      latitude: string;
      longitude: string;
      source_name: string | null;
    }>(`
      select latitude, longitude, source_name
      from stores
      where id = 'aldi-23111'
    `);

    expect(after.rows.length).toBe(1);
    expect(Number(after.rows[0]?.latitude)).toBeCloseTo(37.6365, 3);
    expect(Number(after.rows[0]?.longitude)).toBeCloseTo(-77.3608, 3);
    expect(after.rows[0]?.source_name).toBe("yum4less-market-catalog");
    expect(Number(after.rows[0]?.latitude)).not.toBeCloseTo(37.628179, 3);
  });

  it("keeps separate Kroger API rows when source_store_id does not match legacy slug rows", async () => {
    const pool = getDbPool();
    await pool.query(`
      update stores
      set
        latitude = 37.615460,
        longitude = -77.329390,
        source_name = 'yum4less-internal-catalog',
        source_store_id = 'kroger-mechanicsville',
        name = 'Kroger',
        last_verified_at = now()
      where id = 'kroger-mechanicsville'
    `);
    await pool.query(`
      insert into stores (
        id, name, kind, city, state, latitude, longitude, source_name, source_store_id, last_verified_at
      )
      values (
        'kroger-02900529',
        'Kroger',
        'grocery',
        'Mechanicsville',
        'VA',
        37.615500,
        -77.329400,
        'kroger-official-api',
        '02900529',
        now()
      )
      on conflict (id) do nothing
    `);
    await pool.query(`
      insert into price_observations (
        store_id,
        ingredient_id,
        price,
        in_stock,
        observed_at,
        source_name,
        confidence_score
      )
      values (
        'kroger-02900529',
        'chicken-thighs',
        5.99,
        true,
        now(),
        'kroger-official-api',
        0.9
      )
    `);

    const merged = await syncV1ChainStoresToCatalog({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "geocodio",
        zipCode: "23111",
      },
      zipCode: "23111",
      providerStoreSearches: [
        {
          provider: "kroger",
          label: "Kroger",
          configured: true,
          status: "available",
          provenance: "official-api",
          retrievalMode: "live",
          fallbackUsed: false,
          message: "Fixture Kroger discovery for bootstrap merge test.",
          fetchedAt: new Date().toISOString(),
          stores: [
            {
              provider: "kroger",
              providerStoreId: "02900529",
              name: "Kroger",
              city: "Mechanicsville",
              state: "VA",
              latitude: 37.6155,
              longitude: -77.3294,
            },
            {
              provider: "kroger",
              providerStoreId: "02900515",
              name: "Kroger",
              city: "Richmond",
              state: "VA",
              latitude: 37.701,
              longitude: -77.401,
            },
          ],
        },
      ],
    });

    expect(merged).toBeGreaterThan(0);

    const krogerRows = await pool.query<{
      id: string;
      source_store_id: string | null;
      source_name: string | null;
    }>(`
      select id, source_store_id, source_name
      from stores
      where id in ('kroger-mechanicsville', 'kroger-02900529', 'kroger-02900515')
      order by id
    `);

    expect(krogerRows.rows.some((row) => row.id === "kroger-02900529")).toBe(true);
    expect(
      krogerRows.rows.find((row) => row.id === "kroger-mechanicsville")?.source_store_id,
    ).toBe("kroger-mechanicsville");
    expect(krogerRows.rows.some((row) => row.id === "kroger-02900515")).toBe(true);

    const migratedObservation = await pool.query<{ store_id: string }>(
      `
        select store_id
        from price_observations
        where ingredient_id = 'chicken-thighs'
          and source_name = 'kroger-official-api'
        order by observed_at desc
        limit 1
      `,
    );

    expect(migratedObservation.rows[0]?.store_id).toBe("kroger-02900529");
  });

  it("refreshes Aldi coordinates from the nearest OSM Aldi store", async () => {
    const pool = getDbPool();
    await pool.query(`
      insert into stores (
        id, name, kind, city, state, latitude, longitude, source_name, source_store_id, last_verified_at
      )
      values (
        'aldi-23111',
        'Aldi',
        'grocery',
        'Mechanicsville',
        'VA',
        37.628179,
        -77.281955,
        'yum4less-market-catalog',
        'osm-node-900007',
        now()
      )
      on conflict (id) do update set
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        source_name = excluded.source_name,
        source_store_id = excluded.source_store_id,
        last_verified_at = now()
    `);

    const updated = await refreshBootstrapRankedStoreCoordinates({
      location: {
        city: "Mechanicsville",
        state: "VA",
        latitude: 37.6085,
        longitude: -77.3321,
        source: "geocodio",
        zipCode: "23111",
      },
      zipCode: "23111",
      osmFoodRetailStores: fixtureOsmFoodRetailStores23111,
      providerStoreSearches: [],
    });

    expect(updated).toBeGreaterThan(0);

    const after = await pool.query<{
      latitude: string;
      longitude: string;
      source_name: string | null;
    }>(`
      select latitude, longitude, source_name
      from stores
      where id = 'aldi-23111'
    `);

    expect(Number(after.rows[0]?.latitude)).toBeCloseTo(37.6365, 3);
    expect(Number(after.rows[0]?.longitude)).toBeCloseTo(-77.3608, 3);
    expect(after.rows[0]?.source_name).toBe("yum4less-market-catalog");
    expect(Number(after.rows[0]?.latitude)).not.toBeCloseTo(37.628179, 3);
  });
});
