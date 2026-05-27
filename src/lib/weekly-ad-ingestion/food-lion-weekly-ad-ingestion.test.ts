import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFoodLionWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/food-lion-weekly-ad-ingestion";
import * as flippFeed from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import * as pageFetcher from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("food lion weekly ad ingestion", () => {
  beforeEach(() => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
  });

  it("uses fixture HTML when YUM4LESS_WEEKLY_AD_FIXTURE is set", async () => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
    const flippSpy = vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant");

    const client = createFoodLionWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "food-lion",
      storeId: "food-lion-mechanicsville",
      storeName: "Food Lion",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "broccoli"],
    });

    expect(flippSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
  });

  it("loads live offers from Flipp when direct HTTP would be blocked", async () => {
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([
      {
        productName: "Fresh Corn on the Cob",
        price: 1,
        saleLabel: "Directional — weekly ad syndicated feed",
      },
      {
        productName: "Food Lion Mini Cucumbers",
        price: 1.99,
      },
    ]);
    const pageSpy = vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent");

    const client = createFoodLionWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "food-lion",
      storeId: "food-lion-mechanicsville",
      storeName: "Food Lion",
      zipCode: "23111",
      trackedIngredientIds: ["broccoli"],
    });

    expect(pageSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-partner-feed");
    expect(result.message).toContain("Flipp syndicated weekly-ad feed");
  });

  it("reports WAF blocking when Flipp and scrape both fail", async () => {
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([]);
    vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent").mockRejectedValue(
      new Error("HTTP 403"),
    );

    const client = createFoodLionWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "food-lion",
      storeId: "food-lion-mechanicsville",
      storeName: "Food Lion",
      zipCode: "23111",
      trackedIngredientIds: ["broccoli"],
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("HTTP 403");
    expect(result.message).toContain("Flipp syndicated feed also returned no offers");
  });
});
