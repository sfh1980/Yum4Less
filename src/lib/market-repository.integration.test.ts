import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbPoolForTests } from "@/lib/db";
import {
  deleteAllPriceObservations,
  insertPriceObservation,
} from "@/lib/price-observation-writes";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { KROGER_OFFICIAL_PRICE_SOURCE } from "@/lib/price-source-policy";

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

  it("prefers official online prices over newer weekly-ad rows for the same ingredient", async () => {
    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 7.25,
      saleLabel: "Kroger weekly-ad special",
      observedAt: new Date("2026-05-28T12:00:00.000Z"),
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-weekly-ad-chicken-thighs",
      confidenceScore: 0.9,
      notes: "weekly ad test row",
    });
    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "chicken-thighs",
      price: 7.49,
      observedAt: new Date("2026-05-28T10:00:00.000Z"),
      sourceName: KROGER_OFFICIAL_PRICE_SOURCE,
      sourceRecordId: "kroger-online-chicken-thighs",
      confidenceScore: 0.95,
      notes: "official online test row",
    });

    const result = await getMarketDataSnapshot();
    const observation = result.snapshot.priceObservations.find(
      (row) =>
        row.storeId === "kroger-mechanicsville" &&
        row.ingredientId === "chicken-thighs",
    );

    expect(observation?.priceSource).toBe(KROGER_OFFICIAL_PRICE_SOURCE);
    expect(observation?.price).toBe(7.49);
    expect(observation?.priceSourceKind).toBe("official-online");
    expect(observation?.freshnessHoursAgo).toEqual(expect.any(Number));
  });

  it("excludes expired sale rows from ranked price observation reads", async () => {
    const pastEnd = new Date("2020-01-01T00:00:00.000Z");
    const futureEnd = new Date("2099-12-31T23:59:59.000Z");

    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 0.59,
      saleLabel: "Expired weekly deal",
      observedAt: new Date("2026-05-20T12:00:00.000Z"),
      validThrough: pastEnd,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-expired-black-beans",
      confidenceScore: 0.8,
      notes: "expired row for integration test",
    });
    await insertPriceObservation({
      storeId: "kroger-mechanicsville",
      ingredientId: "black-beans",
      price: 0.79,
      saleLabel: "Current weekly deal",
      observedAt: new Date("2026-05-28T12:00:00.000Z"),
      validThrough: futureEnd,
      sourceName: "kroger-weekly-ad-scrape",
      sourceRecordId: "kroger-current-black-beans",
      confidenceScore: 0.82,
      notes: "current row for integration test",
    });

    const result = await getMarketDataSnapshot();
    const observation = result.snapshot.priceObservations.find(
      (row) =>
        row.storeId === "kroger-mechanicsville" &&
        row.ingredientId === "black-beans",
    );

    expect(observation?.price).toBe(0.79);
    expect(observation?.saleLabel).toBe("Current weekly deal");
  });
});
