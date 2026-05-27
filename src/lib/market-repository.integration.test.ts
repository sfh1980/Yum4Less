import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbPoolForTests } from "@/lib/db";
import { deleteAllPriceObservations } from "@/lib/price-observation-writes";
import { getMarketDataSnapshot } from "@/lib/market-repository";

describe("getMarketDataSnapshot (integration)", () => {
  beforeEach(async () => {
    await deleteAllPriceObservations();
  });

  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("loads curated catalog from Docker Postgres without sample pricing rows", async () => {
    const result = await getMarketDataSnapshot();

    expect(result.source).toBe("database");
    expect(result.snapshot.stores.length).toBeGreaterThan(0);
    expect(result.snapshot.recipes.length).toBeGreaterThan(0);
    expect(result.snapshot.priceObservations).toHaveLength(0);
    expect(result.snapshot.stores.some((store) => store.id === "kroger-mechanicsville")).toBe(
      true,
    );
  });
});
