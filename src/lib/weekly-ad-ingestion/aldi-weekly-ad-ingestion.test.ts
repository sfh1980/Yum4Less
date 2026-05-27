import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAldiWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/aldi-weekly-ad-ingestion";
import * as flippFeed from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import * as pageFetcher from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("aldi weekly ad ingestion", () => {
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

    const client = createAldiWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "aldi",
      storeId: "aldi-mechanicsville",
      storeName: "Aldi",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "black-beans"],
    });

    expect(flippSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-scrape");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(
      true,
    );
  });

  it("loads live offers from Flipp syndicated feed without direct scrape", async () => {
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([
      {
        productName: "Fresh Family Pack Chicken Thighs",
        price: 2.49,
        saleLabel: "Directional — weekly ad syndicated feed",
      },
      {
        productName: "Black Beans",
        price: 0.79,
      },
    ]);
    const pageSpy = vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent");

    const client = createAldiWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "aldi",
      storeId: "aldi-mechanicsville",
      storeName: "Aldi",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "black-beans"],
    });

    expect(pageSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-partner-feed");
    expect(result.fallbackUsed).toBe(true);
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.message).toContain("Flipp syndicated weekly-ad feed");
  });

  it("falls back to direct scrape when Flipp returns no offers", async () => {
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([]);
    vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent").mockResolvedValue({
      html: `<script id="weekly-ad-offers-data">[{"productName":"Black Beans","price":0.79}]</script>`,
      method: "browser",
      parsedOfferCount: 1,
    });

    const client = createAldiWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "aldi",
      storeId: "aldi-mechanicsville",
      storeName: "Aldi",
      zipCode: "23111",
      trackedIngredientIds: ["black-beans"],
    });

    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-scrape");
    expect(result.message).toContain("browser scrape");
  });
});
