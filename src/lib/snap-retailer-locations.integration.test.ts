import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { fixtureSnapRetailers23111 } from "@/lib/fixtures/snap-retailers.fixtures";
import {
  findSnapRetailersNearLocation,
  upsertSnapRetailerLocations,
} from "@/lib/snap-retailer-locations";

describe("snap retailer locations (integration)", () => {
  afterEach(async () => {
    const pool = getDbPool();
    await pool.query(`delete from snap_retailer_locations where id like 'snap-%'`);
    await resetDbPoolForTests();
  });

  it("upserts SNAP reference rows and finds them near ZIP 23111", async () => {
    const upserted = await upsertSnapRetailerLocations(fixtureSnapRetailers23111);
    expect(upserted).toBeGreaterThan(0);

    const discovery = await findSnapRetailersNearLocation({
      latitude: 37.6085,
      longitude: -77.3321,
      radiusMiles: 12,
    });

    expect(discovery.rows.length).toBeGreaterThanOrEqual(2);
    expect(discovery.rows.some((row) => row.retailerName.includes("FOOD LION"))).toBe(
      true,
    );
  });
});
