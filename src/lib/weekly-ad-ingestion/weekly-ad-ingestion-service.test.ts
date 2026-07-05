import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSaleConfidence } from "@/lib/sale-confidence";
import { createAldiWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/aldi-weekly-ad-ingestion";
import {
  getWeeklyAdIngestionClients,
  runWeeklyAdIngestionForStores,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import * as weeklyAdOfferSync from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";
import * as priceObservationWrites from "@/lib/price-observation-writes";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("weekly ad ingestion service", () => {
  beforeEach(() => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
  });

  afterEach(() => {
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
  });

  it("registers live scrapers for six configured chains plus the Dollar General stub", () => {
    const clients = getWeeklyAdIngestionClients();

    expect(clients.map((client) => client.chain)).toEqual([
      "aldi",
      "food-lion",
      "publix",
      "kroger",
      "walmart",
      "lidl",
      "dollar-general",
    ]);
    expect(clients.find((client) => client.chain === "aldi")?.configured).toBe(true);
    expect(clients.find((client) => client.chain === "food-lion")?.configured).toBe(true);
    expect(clients.find((client) => client.chain === "publix")?.configured).toBe(true);
    expect(clients.find((client) => client.chain === "kroger")?.configured).toBe(true);
    expect(clients.find((client) => client.chain === "walmart")?.configured).toBe(true);
    expect(clients.find((client) => client.chain === "lidl")?.configured).toBe(true);
  });

  it("parses and matches Aldi fixture offers for tracked ingredients", async () => {
    const client = createAldiWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "aldi",
      storeId: "aldi-mechanicsville",
      storeName: "Aldi",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "broccoli", "spinach", "black-beans"],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "black-beans")).toBe(true);
  });

  it("runs ingestion across nearby stores without requiring DB persistence", async () => {
    const { results } = await runWeeklyAdIngestionForStores({
      nearbyStores: [
        { id: "aldi-mechanicsville", name: "Aldi", chain: "aldi" },
        { id: "food-lion-mechanicsville", name: "Food Lion", chain: "food-lion" },
        { id: "publix-atlee", name: "Publix", chain: "publix" },
      ],
      zipCode: "23111",
      persistToDatabase: false,
    });

    expect(results).toHaveLength(3);
    expect(results.find((result) => result.chain === "aldi")?.offers.length).toBeGreaterThan(
      0,
    );
    expect(
      results.find((result) => result.chain === "food-lion")?.offers.length,
    ).toBeGreaterThan(0);
    expect(
      results.find((result) => result.chain === "publix")?.offers.length,
    ).toBeGreaterThan(0);
  });

  it("fans out one Kroger weekly-ad ingest to every Kroger store id when persisting", async () => {
    const purgeSpy = vi
      .spyOn(priceObservationWrites, "purgeStaleRankedPriceObservations")
      .mockResolvedValue(0);
    const syncSpy = vi
      .spyOn(weeklyAdOfferSync, "syncWeeklyAdOffersToPriceObservations")
      .mockResolvedValue({
        chain: "kroger",
        storeId: "kroger-mechanicsville",
        syncedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        retrievalMode: "fixture",
        message: "synced",
      });

    await runWeeklyAdIngestionForStores({
      nearbyStores: [
        { id: "kroger-mechanicsville", name: "Kroger", chain: "kroger" },
        { id: "kroger-02900529", name: "Kroger Marketplace", chain: "kroger" },
      ],
      zipCode: "23111",
      persistToDatabase: true,
    });

    expect(purgeSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy).toHaveBeenCalledTimes(2);
    const syncedStoreIds = syncSpy.mock.calls.map(
      (call) => call[0]?.result.offers[0]?.storeId,
    );
    expect(syncedStoreIds.sort()).toEqual(["kroger-02900529", "kroger-mechanicsville"]);

    purgeSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it("parses Food Lion fixture offers for tracked ingredients", async () => {
    const { createFoodLionWeeklyAdIngestionClient } = await import(
      "@/lib/weekly-ad-ingestion/food-lion-weekly-ad-ingestion"
    );
    const client = createFoodLionWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "food-lion",
      storeId: "food-lion-mechanicsville",
      storeName: "Food Lion",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "broccoli", "spinach", "black-beans"],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "broccoli")).toBe(true);
  });

  it("parses Publix fixture offers for tracked ingredients", async () => {
    const { createPublixWeeklyAdIngestionClient } = await import(
      "@/lib/weekly-ad-ingestion/publix-weekly-ad-ingestion"
    );
    const client = createPublixWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "publix",
      storeId: "publix-atlee",
      storeName: "Publix",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "broccoli", "lemon", "parmesan", "cabbage"],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "broccoli")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "parmesan")).toBe(true);
  });

  it("parses Lidl fixture offers for tracked ingredients", async () => {
    const { createLidlWeeklyAdIngestionClient } = await import(
      "@/lib/weekly-ad-ingestion/lidl-weekly-ad-ingestion"
    );
    const client = createLidlWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "lidl",
      storeId: "lidl-mechanicsville",
      storeName: "Lidl",
      zipCode: "23111",
      trackedIngredientIds: ["ground-beef", "salmon-fillet", "bell-peppers", "butter"],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "ground-beef")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "salmon-fillet")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "bell-peppers")).toBe(true);
  });

  it("parses Kroger fixture offers for tracked ingredients", async () => {
    const { createKrogerWeeklyAdIngestionClient } = await import(
      "@/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion"
    );
    const client = createKrogerWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      storeName: "Kroger",
      zipCode: "23111",
      trackedIngredientIds: [
        "chicken-thighs",
        "broccoli",
        "baby-potatoes",
        "olive-oil",
        "black-beans",
      ],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "black-beans")).toBe(true);
  });

  it("parses Walmart fixture offers for tracked ingredients", async () => {
    const { createWalmartWeeklyAdIngestionClient } = await import(
      "@/lib/weekly-ad-ingestion/walmart-weekly-ad-ingestion"
    );
    const client = createWalmartWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-rocketts",
      storeName: "Walmart Supercenter",
      zipCode: "23111",
      trackedIngredientIds: [
        "black-beans",
        "corn-tortillas",
        "cabbage",
        "lime",
        "tofu",
        "jasmine-rice",
        "olive-oil",
      ],
    });

    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "black-beans")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "tofu")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "jasmine-rice")).toBe(true);
  });
});

describe("weekly ad sale confidence", () => {
  it("labels scraped weekly-ad specials with verify language", () => {
    const confidence = getSaleConfidence({
      saleLabel: "Weekly special",
      freshnessDaysAgo: 0,
      dataSource: "database",
      priceSource: "aldi-weekly-ad-scrape",
      matchConfidence: 0.82,
    });

    expect(confidence.label).toBe("Sale price — estimate only");
    expect(confidence.note).toContain("saved store prices");
  });
});
