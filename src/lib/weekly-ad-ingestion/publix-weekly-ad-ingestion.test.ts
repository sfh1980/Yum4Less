import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublixWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/publix-weekly-ad-ingestion";
import * as flippResolver from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import * as publixFlyerFallback from "@/lib/weekly-ad-ingestion/publix-flipp-flyer-fallback";
import * as publixFetcher from "@/lib/weekly-ad-ingestion/publix-weekly-ad-fetcher";
import * as publixParser from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import * as publixStore from "@/lib/weekly-ad-ingestion/publix-weekly-ad-store";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("publix weekly ad ingestion", () => {
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

    const client = createPublixWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "publix",
      storeId: "publix-1626",
      storeName: "Publix",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "broccoli"],
    });

    expect(flippSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(true);
  });

  it("adds Flipp-only ingredient matches without replacing scrape-covered ingredients", async () => {
    vi.spyOn(publixStore, "resolvePublixStoreForZip").mockResolvedValue({
      storeCookie: {
        StoreName: "Brandy Creek Commons",
        StoreNumber: 1626,
        Option: "ACFHLNOTY",
        ShortStoreName: "Brandy Creek Commons",
      },
      storeKey: "1626",
      storeName: "Brandy Creek Commons",
    });
    vi.spyOn(publixFetcher, "fetchPublixWeeklyAdPage").mockResolvedValue({
      html: "<html></html>",
      method: "browser",
      networkJsonBodies: [],
      waitSelectorMatched: true,
      attempts: 1,
    });
    vi.spyOn(publixParser, "parsePublixWeeklyAd").mockReturnValue([
      { productName: "Perdue Boneless Skinless Chicken Breasts", price: 3.99 },
      { productName: "Broccoli Crowns", price: 1.99 },
    ]);
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [
        { productName: "Publix Boneless Skinless Chicken Breasts", price: 3.49 },
        { productName: "Kraft Parmesan Cheese", price: 4.29 },
      ],
    });

    const client = createPublixWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "publix",
      storeId: "publix-1626",
      storeName: "Publix",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-breast", "broccoli", "parmesan"],
    });

    expect(publixFetcher.fetchPublixWeeklyAdPage).toHaveBeenCalledWith(
      expect.objectContaining({
        zipCode: "23111",
        rememberedOfferCount: null,
      }),
    );
    expect(result.status).toBe("live");
    expect(result.offers.filter((offer) => offer.ingredientId === "chicken-breast")).toHaveLength(1);
    expect(result.offers.filter((offer) => offer.ingredientId === "parmesan")).toHaveLength(1);
    expect(result.message).toContain("Added 1 Flipp supplemental ingredient match");
  });

  it("keeps scrape results when Flipp supplemental lookup fails", async () => {
    vi.spyOn(publixStore, "resolvePublixStoreForZip").mockResolvedValue({
      storeCookie: {
        StoreName: "Brandy Creek Commons",
        StoreNumber: 1626,
        Option: "ACFHLNOTY",
        ShortStoreName: "Brandy Creek Commons",
      },
      storeKey: "1626",
      storeName: "Brandy Creek Commons",
    });
    vi.spyOn(publixFetcher, "fetchPublixWeeklyAdPage").mockResolvedValue({
      html: "<html></html>",
      method: "browser",
      networkJsonBodies: [],
      waitSelectorMatched: true,
      attempts: 1,
    });
    vi.spyOn(publixParser, "parsePublixWeeklyAd").mockReturnValue([
      { productName: "Broccoli Crowns", price: 1.99 },
    ]);
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockRejectedValue(
      new Error("Flipp timeout"),
    );

    const client = createPublixWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "publix",
      storeId: "publix-1626",
      storeName: "Publix",
      zipCode: "23111",
      trackedIngredientIds: ["broccoli"],
    });

    expect(result.status).toBe("live");
    expect(result.offers.filter((offer) => offer.ingredientId === "broccoli")).toHaveLength(1);
    expect(result.message).toContain("Flipp supplemental lookup was unavailable");
  });

  it("fills a thin scrape from the Flipp flyer and keeps the scrape price for a shared ingredient", async () => {
    vi.spyOn(publixStore, "resolvePublixStoreForZip").mockResolvedValue({
      storeCookie: {
        StoreName: "Virginia Center",
        StoreNumber: 1591,
        Option: "ACFHLNOTY",
        ShortStoreName: "Virginia Center",
      },
      storeKey: "1591",
      storeName: "Virginia Center",
    });
    vi.spyOn(publixFetcher, "fetchPublixWeeklyAdPage").mockResolvedValue({
      html: "<html></html>",
      method: "browser",
      networkJsonBodies: [],
      waitSelectorMatched: true,
      attempts: 1,
      savingsCardCount: 5,
    });
    vi.spyOn(publixParser, "parsePublixWeeklyAd").mockReturnValue([
      { productName: "Perdue Boneless Skinless Chicken Breasts", price: 3.99 },
    ]);
    const searchSpy = vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain");
    vi.spyOn(publixFlyerFallback, "loadPublixFlippFlyerOffers").mockResolvedValue({
      offers: [
        {
          productName: "Publix Boneless Skinless Chicken Breasts",
          price: 2.49,
          saleLabel: "Flipp flyer",
          validFrom: "2026-11-05T00:00:00-05:00",
          validThrough: "2026-11-11T23:59:59-05:00",
        },
        {
          productName: "Kraft Parmesan Cheese",
          price: 4.29,
          saleLabel: "Flipp flyer",
          validFrom: "2026-11-05T00:00:00-05:00",
          validThrough: "2026-11-11T23:59:59-05:00",
        },
      ],
      flyerId: 22,
      itemCount: 348,
    });

    const client = createPublixWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "publix",
      storeId: "publix-1591",
      storeName: "Virginia Center",
      zipCode: "23005",
      trackedIngredientIds: ["chicken-breast", "parmesan"],
    });

    expect(searchSpy).not.toHaveBeenCalled();
    expect(result.thinPage).toBe(true);
    expect(result.offers.filter((offer) => offer.ingredientId === "chicken-breast")).toEqual([
      expect.objectContaining({ price: 3.99 }),
    ]);
    expect(result.offers.filter((offer) => offer.ingredientId === "parmesan")).toEqual([
      expect.objectContaining({
        price: 4.29,
        saleLabel: "Flipp flyer",
        validFrom: "2026-11-05T00:00:00-05:00",
        validThrough: "2026-11-11T23:59:59-05:00",
      }),
    ]);
    expect(result.message).toContain("Flipp flyer ingredient match");
  });
});
