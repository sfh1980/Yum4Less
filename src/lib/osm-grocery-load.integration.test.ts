import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { loadOsmGroceryFile } from "@/lib/osm-grocery-load";
import { loadOsmGroceryPlacesNear } from "@/lib/osm-grocery-places";
import { isOsmOverpassDisabled } from "@/lib/osm-food-retail-discovery";

const LOCATOR_ID = "osm-node-880106";

function writeFixture(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "yum4less-osm-"));
  const filePath = join(dir, name);
  writeFileSync(filePath, body, "utf8");
  return filePath;
}

function node(id: number, name: string, shop: string, lat = 35.32, lon = -80.84): string {
  return `<node id="${id}" lat="${lat}" lon="${lon}" timestamp="2026-11-01T00:00:00Z"><tag k="shop" v="${shop}"/><tag k="name" v="${name}"/></node>`;
}

function file(parts: string[]): string {
  return `<?xml version="1.0"?><osm>${parts.join("")}</osm>`;
}

describe("osm grocery loader", () => {
  const originalOverpass = process.env.YUM4LESS_OSM_OVERPASS_DISABLED;

  afterEach(async () => {
    if (originalOverpass === undefined) {
      delete process.env.YUM4LESS_OSM_OVERPASS_DISABLED;
    } else {
      process.env.YUM4LESS_OSM_OVERPASS_DISABLED = originalOverpass;
    }
    const pool = getDbPool();
    await pool.query(
      `delete from osm_grocery_places where osm_id between 880100 and 880399`,
    );
    await pool.query(`delete from stores where id = $1`, [LOCATOR_ID]);
    await pool.query(`delete from price_observations where store_id = $1`, [LOCATOR_ID]);
    await resetDbPoolForTests();
  });

  it("loads grocery pins, leaves a locator pin alone, closes a place missing twice, and does not attach prices", async () => {
    process.env.YUM4LESS_OSM_OVERPASS_DISABLED = "1";
    const pool = getDbPool();
    await pool.query(
      `
        insert into stores (
          id, name, kind, city, state, latitude, longitude, source_name, source_store_id
        ) values (
          $1, 'Publix Locator', 'grocery', 'Charlotte', 'NC', 35.330000, -80.850000,
          'publix-store-locator', '4242'
        )
      `,
      [LOCATOR_ID],
    );
    const marketsBefore = await pool.query<{ count: string }>(
      `select count(*)::text as count from active_markets`,
    );
    const rankedBefore = await pool.query<{ count: string }>(
      `select count(*)::text as count from chain_registry where shopper_ranked = true`,
    );

    const first = writeFixture(
      "first.osm",
      file([
        node(880101, "Fixture Grocery", "supermarket"),
        node(880102, "Fixture Convenience", "convenience"),
        `<node id="880103" lat="35.33" lon="-80.85" timestamp="2026-11-01T00:00:00Z"><tag k="amenity" v="fuel"/><tag k="name" v="Fixture Fuel"/></node>`,
        node(880106, "Renamed Locator", "supermarket", 35.33, -80.85),
        node(880120, "Far Grocery", "supermarket", 37.6, -77.37),
      ]),
    );
    const dry = await loadOsmGroceryFile({ filePath: first, dryRun: true });
    expect(dry.wrote).toBe(false);
    expect(dry.kept).toBe(3);
    const none = await pool.query<{ count: string }>(
      `select count(*)::text as count from osm_grocery_places where osm_id between 880100 and 880399`,
    );
    expect(none.rows[0]?.count).toBe("0");

    await loadOsmGroceryFile({ filePath: first, dryRun: false });
    const renamed = writeFixture(
      "renamed.osm",
      file([
        node(880101, "Fixture Grocery Renamed", "supermarket"),
        node(880106, "Still Not The Locator", "supermarket", 35.33, -80.85),
        node(880120, "Far Grocery", "supermarket", 37.6, -77.37),
      ]),
    );
    await loadOsmGroceryFile({ filePath: renamed, dryRun: false });
    const grocery = await pool.query<{ name: string; count: string }>(
      `
        select name, count(*)::text as count
        from osm_grocery_places
        where id = 'osm-node-880101'
        group by name
      `,
    );
    expect(grocery.rows).toEqual([{ name: "Fixture Grocery Renamed", count: "1" }]);

    const locator = await pool.query<{ name: string; source_name: string; latitude: string }>(
      `select name, source_name, latitude from stores where id = $1`,
      [LOCATOR_ID],
    );
    expect(locator.rows[0]).toMatchObject({
      name: "Publix Locator",
      source_name: "publix-store-locator",
    });
    expect(Number(locator.rows[0]?.latitude)).toBeCloseTo(35.33, 4);

    const missingOnce = writeFixture(
      "missing-once.osm",
      file([node(880101, "Fixture Grocery Renamed", "supermarket")]),
    );
    await loadOsmGroceryFile({ filePath: missingOnce, dryRun: false });
    const once = await pool.query<{ consecutive_misses: number; closed_at: Date | null }>(
      `select consecutive_misses, closed_at from osm_grocery_places where id = 'osm-node-880120'`,
    );
    expect(once.rows[0]?.consecutive_misses).toBe(1);
    expect(once.rows[0]?.closed_at).toBeNull();

    await loadOsmGroceryFile({ filePath: missingOnce, dryRun: false });
    const twice = await pool.query<{ closed_at: Date | null }>(
      `select closed_at from osm_grocery_places where id = 'osm-node-880120'`,
    );
    expect(twice.rows[0]?.closed_at).not.toBeNull();

    expect(isOsmOverpassDisabled()).toBe(true);
    const near = await loadOsmGroceryPlacesNear({
      latitude: 35.32,
      longitude: -80.84,
      radiusMiles: 5,
    });
    const names = near.map((place) => place.name).sort();
    expect(names).toContain("Fixture Grocery Renamed");
    expect(names).not.toContain("Fixture Convenience");
    expect(names).not.toContain("Fixture Fuel");
    expect(names).not.toContain("Far Grocery");
    expect(near.every((place) => place.sourceName === "osm-extract")).toBe(true);

    const prices = await pool.query<{ count: string }>(
      `
        select count(*)::text as count
        from price_observations
        where store_id in ('osm-node-880101', 'osm-node-880120', $1)
      `,
      [LOCATOR_ID],
    );
    expect(prices.rows[0]?.count).toBe("0");
    const marketsAfter = await pool.query<{ count: string }>(
      `select count(*)::text as count from active_markets`,
    );
    const rankedAfter = await pool.query<{ count: string }>(
      `select count(*)::text as count from chain_registry where shopper_ranked = true`,
    );
    expect(marketsAfter.rows[0]?.count).toBe(marketsBefore.rows[0]?.count);
    expect(rankedAfter.rows[0]?.count).toBe(rankedBefore.rows[0]?.count);
  });
});
