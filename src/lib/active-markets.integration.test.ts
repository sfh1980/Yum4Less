import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import {
  listActiveMarketZipCodes,
  listIngestMarkets,
  upsertActiveMarket,
} from "@/lib/active-markets";
import {
  readZipGeocodeCache,
  upsertZipGeocodeCache,
} from "@/lib/zip-geocode-cache";

const TEST_ZIP = "88888";

describe("active_markets and zip_geocode_cache (integration)", () => {
  const originalCacheFlag = process.env.YUM4LESS_ZIP_GEOCODE_CACHE;

  afterEach(async () => {
    if (originalCacheFlag === undefined) {
      delete process.env.YUM4LESS_ZIP_GEOCODE_CACHE;
    } else {
      process.env.YUM4LESS_ZIP_GEOCODE_CACHE = originalCacheFlag;
    }

    const pool = getDbPool();
    await pool.query("delete from active_markets where zip_code = $1", [TEST_ZIP]);
    await pool.query("delete from zip_geocode_cache where zip_code = $1", [TEST_ZIP]);
    await resetDbPoolForTests();
  });

  it("creates empty market and geocode tables with no default ZIP", async () => {
    const pool = getDbPool();
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in ('active_markets', 'zip_geocode_cache')
       order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "active_markets",
      "zip_geocode_cache",
    ]);

    const densityCols = await pool.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_name = 'active_markets'
         and column_name in ('density_class', 'ingest_miles')
       order by column_name`,
    );
    expect(densityCols.rows.map((row) => row.column_name)).toEqual([
      "density_class",
      "ingest_miles",
    ]);

    const seededHome = await pool.query<{ n: string }>(
      `select count(*)::text as n from active_markets where zip_code = '23111'`,
    );
    expect(seededHome.rows[0]?.n).toBe("0");
  });

  it("lists only active markets and persists a geocode cache row for ingest", async () => {
    process.env.YUM4LESS_ZIP_GEOCODE_CACHE = "1";

    expect(await listActiveMarketZipCodes()).not.toContain(TEST_ZIP);

    await upsertActiveMarket({
      zipCode: TEST_ZIP,
      source: "ops",
      latitude: 41.88,
      longitude: -87.63,
    });
    await getDbPool().query(
      `update active_markets set status = 'paused' where zip_code = $1`,
      [TEST_ZIP],
    );
    expect(await listActiveMarketZipCodes()).not.toContain(TEST_ZIP);

    await upsertActiveMarket({ zipCode: TEST_ZIP, source: "ops" });
    expect(await listActiveMarketZipCodes()).toContain(TEST_ZIP);

    const listed = await listIngestMarkets();
    expect(listed.some((row) => row.zipCode === TEST_ZIP && row.status === "active")).toBe(
      true,
    );

    await upsertZipGeocodeCache({
      zipCode: TEST_ZIP,
      city: "Testville",
      state: "IL",
      latitude: 41.88,
      longitude: -87.63,
      source: "geocodio",
    });

    const cached = await readZipGeocodeCache(TEST_ZIP);
    expect(cached).toEqual(
      expect.objectContaining({
        zipCode: TEST_ZIP,
        city: "Testville",
        state: "IL",
        source: "geocodio",
      }),
    );
  });
});
