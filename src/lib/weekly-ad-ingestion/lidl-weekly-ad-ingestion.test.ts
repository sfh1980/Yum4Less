import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLidlWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/lidl-weekly-ad-ingestion";
import { LIDL_WEEKLY_AD_HUB_URL } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import * as flippResolver from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import * as pageFetcher from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("lidl weekly ad ingestion", () => {
  it("uses the live leaflets hub, not the 404 weekly-ads path", () => {
    expect(LIDL_WEEKLY_AD_HUB_URL).toContain("/c/offers-leaflets/");
    expect(LIDL_WEEKLY_AD_HUB_URL).not.toContain("/weekly-ads");
  });

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
    const flippSpy = vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain");

    const client = createLidlWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "lidl",
      storeId: "lidl-mechanicsville",
      storeName: "Lidl",
      zipCode: "23111",
      trackedIngredientIds: ["ground-beef", "salmon-fillet", "bell-peppers"],
    });

    expect(flippSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "ground-beef")).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "salmon-fillet")).toBe(true);
  });

  it("loads live offers from Flipp syndicated feed without direct scrape", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [
        {
          productName: "Butcher's Specialty fresh grass-fed ground beef, 93% lean",
          price: 5.49,
          saleLabel: "Directional — weekly ad syndicated feed",
        },
        {
          productName: "red bell peppers",
          price: 2.49,
        },
      ],
    });
    const pageSpy = vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent");

    const client = createLidlWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "lidl",
      storeId: "lidl-mechanicsville",
      storeName: "Lidl",
      zipCode: "23111",
      trackedIngredientIds: ["ground-beef", "bell-peppers"],
    });

    expect(pageSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-partner-feed");
    expect(result.fallbackUsed).toBe(true);
    expect(result.offers.some((offer) => offer.ingredientId === "ground-beef")).toBe(true);
    expect(result.message).toContain("Flipp syndicated weekly-ad feed");
  });

  it("falls back to direct page scrape when Flipp returns no offers", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [],
    });
    vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent").mockResolvedValue({
      html: `<script id="weekly-ad-offers-data">[{"productName":"sweet cream butter","price":1.99}]</script>`,
      method: "browser",
      parsedOfferCount: 1,
    });

    const client = createLidlWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "lidl",
      storeId: "lidl-mechanicsville",
      storeName: "Lidl",
      zipCode: "23111",
      trackedIngredientIds: ["butter"],
    });

    expect(result.status).toBe("live");
    expect(["weekly-ad-partner-feed", "weekly-ad-scrape"]).toContain(result.provenance);
    expect(result.offers.some((offer) => offer.ingredientId === "butter")).toBe(true);
  });
});
