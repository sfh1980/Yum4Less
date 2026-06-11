import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import {
  buildOsmCatalogStore,
  isMapContextOnlyCatalogSource,
  refreshBootstrapRankedStoreCoordinates,
  syncUniversalMapCatalogForZip,
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

  it("overwrites bootstrap Kroger coordinates when live provider discovery is supplied", async () => {
    const pool = getDbPool();
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

  it("refreshes bootstrap Kroger coordinates when weekly-ad ingest already set source_name", async () => {
    const pool = getDbPool();
    await pool.query(`
      update stores
      set
        source_name = 'kroger-weekly-ad-scrape',
        source_store_id = 'kroger-mechanicsville',
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
});
