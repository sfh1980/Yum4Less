import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSaleConfidence } from "@/lib/sale-confidence";
import { createAldiWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/aldi-weekly-ad-ingestion";
import {
  getWeeklyAdIngestionClients,
  runWeeklyAdIngestionForStores,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";

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

  it("registers live scrapers for five priority chains plus Lidl and Dollar General stubs", () => {
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
    expect(clients.find((client) => client.chain === "lidl")?.configured).toBe(false);
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

    expect(result.status).toBe("live");
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

    expect(result.status).toBe("live");
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

    expect(result.status).toBe("live");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "broccoli")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "parmesan")).toBe(true);
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

    expect(result.status).toBe("live");
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

    expect(result.status).toBe("live");
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

    expect(confidence.label).toContain("Aldi");
    expect(confidence.note).toContain("scraped");
  });
});
