import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import {
  ALDI_SCRAPE_MERGE_MIN_MATCHED_INGREDIENTS,
  createAldiWeeklyAdIngestionClient,
  shouldSupplementAldiWeeklyAdWithDirectScrape,
} from "@/lib/weekly-ad-ingestion/aldi-weekly-ad-ingestion";
import * as flippFeed from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import * as pageFetcher from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
const fullCatalogIngredientIds = INTERNAL_CATALOG_INGREDIENTS.map(
  (ingredient) => ingredient.id,
);

describe("shouldSupplementAldiWeeklyAdWithDirectScrape", () => {
  it("scrapes when Flipp returns no offers", () => {
    expect(
      shouldSupplementAldiWeeklyAdWithDirectScrape({
        rawOfferCount: 0,
        matchedIngredientCount: 0,
        trackedIngredientCount: fullCatalogIngredientIds.length,
      }),
    ).toBe(true);
  });

  it("scrapes on full-catalog runs when matched count is below the threshold", () => {
    expect(
      shouldSupplementAldiWeeklyAdWithDirectScrape({
        rawOfferCount: 40,
        matchedIngredientCount: 13,
        trackedIngredientCount: fullCatalogIngredientIds.length,
      }),
    ).toBe(true);
  });

  it("skips scrape on full-catalog runs when matched count meets the threshold", () => {
    expect(
      shouldSupplementAldiWeeklyAdWithDirectScrape({
        rawOfferCount: 80,
        matchedIngredientCount: ALDI_SCRAPE_MERGE_MIN_MATCHED_INGREDIENTS,
        trackedIngredientCount: fullCatalogIngredientIds.length,
      }),
    ).toBe(false);
  });

  it("skips low-coverage scrape for small tracked-ingredient test runs", () => {
    expect(
      shouldSupplementAldiWeeklyAdWithDirectScrape({
        rawOfferCount: 2,
        matchedIngredientCount: 2,
        trackedIngredientCount: 2,
      }),
    ).toBe(false);
  });
});

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
    expect(result.status).toBe("cached");
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

  it("returns live weekly-ad fallback offers when the first merchant search returns no offers", async () => {
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
    expect(["weekly-ad-partner-feed", "weekly-ad-scrape"]).toContain(
      result.provenance,
    );
    expect(result.message).toContain("weekly-ad run");
  });

  it("merges direct scrape offers when full-catalog Flipp coverage is thin", async () => {
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([
      {
        productName: "Fresh Family Pack Chicken Thighs",
        price: 2.49,
      },
      {
        productName: "Black Beans",
        price: 0.79,
      },
    ]);
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForMerchantFlyers").mockResolvedValue(
      [],
    );
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForSearchTerms").mockResolvedValue(
      [],
    );
    const pageSpy = vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent").mockResolvedValue({
      html: `<script id="weekly-ad-offers-data">[{"productName":"Fresh Baby Spinach","price":1.99}]</script>`,
      method: "browser",
      parsedOfferCount: 1,
    });

    const client = createAldiWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "aldi",
      storeId: "aldi-mechanicsville",
      storeName: "Aldi",
      zipCode: "23111",
      trackedIngredientIds: fullCatalogIngredientIds,
    });

    expect(pageSpy).toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-scrape");
    expect(result.offers.some((offer) => offer.ingredientId === "spinach")).toBe(
      true,
    );
    expect(result.message).toContain("browser scrape");
  });
});
