import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKrogerWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-ingestion";
import * as apiFallback from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-api-fallback";
import * as krogerFetcher from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-fetcher";
import * as krogerStore from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-store";
import * as flippResolver from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("kroger weekly ad ingestion", () => {
  beforeEach(() => {
    delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    vi.spyOn(krogerStore, "resolveKrogerStoreForWeeklyAd").mockResolvedValue({
      locationId: "01400376",
      storeName: "Kroger",
    });
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

    const client = createKrogerWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      storeName: "Kroger",
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

  it("uses full Flipp resolver first and skips scrape when offers are returned", async () => {
    const flippSpy = vi
      .spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain")
      .mockResolvedValue({
        retrievalLabel: "Flipp syndicated weekly-ad feed + flyer lookup",
        rawOffers: [
          {
            productName: "Kroger Fresh Chicken Thighs Family Pack",
            price: 5.79,
            saleLabel: "Directional — weekly ad syndicated feed",
          },
          {
            productName: "Kroger Black Beans 15 oz",
            price: 0.99,
          },
        ],
      });
    const scrapeSpy = vi.spyOn(krogerFetcher, "fetchKrogerWeeklyAdPage");
    const apiSpy = vi.spyOn(apiFallback, "fetchKrogerOffersFromOfficialApi");

    const client = createKrogerWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      storeName: "Kroger",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs", "black-beans"],
    });

    expect(flippSpy).toHaveBeenCalledWith({
      chain: "kroger",
      zipCode: "23111",
      merchantName: "Kroger",
      trackedIngredientIds: ["chicken-thighs", "black-beans"],
    });
    expect(scrapeSpy).not.toHaveBeenCalled();
    expect(apiSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-partner-feed");
    expect(result.fallbackUsed).toBe(true);
    expect(result.message).toContain("Flipp syndicated weekly-ad feed + flyer lookup");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(true);
  });

  it("falls back to Kroger scrape when Flipp returns no offers", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [],
    });
    vi.spyOn(krogerFetcher, "fetchKrogerWeeklyAdPage").mockResolvedValue({
      html: `<script id="weekly-ad-offers-data">[{"productName":"Kroger Black Beans 15 oz","price":0.99}]</script>`,
      method: "browser",
      attempts: 1,
      networkJsonBodies: [],
      browserFailed: false,
    });
    const apiSpy = vi.spyOn(apiFallback, "fetchKrogerOffersFromOfficialApi");

    const client = createKrogerWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      storeName: "Kroger",
      zipCode: "23111",
      trackedIngredientIds: ["black-beans"],
    });

    expect(apiSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-scrape");
    expect(result.message).toContain("browser scrape");
    expect(result.offers.some((offer) => offer.ingredientId === "black-beans")).toBe(true);
  });

  it("uses last-resort API partial fill only when Flipp and scrape both return zero", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [],
    });
    vi.spyOn(krogerFetcher, "fetchKrogerWeeklyAdPage").mockResolvedValue({
      html: "<html></html>",
      method: "http",
      attempts: 1,
      networkJsonBodies: [],
      browserFailed: true,
    });
    vi.spyOn(apiFallback, "fetchKrogerOffersFromOfficialApi").mockResolvedValue([
      {
        productName: "Kroger Fresh Chicken Thighs Family Pack",
        price: 5.79,
        saleLabel: "Partial — tracked-ingredient product API fill (not weekly ad discovery)",
      },
    ]);

    const client = createKrogerWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      storeName: "Kroger",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs"],
    });

    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-scrape");
    expect(result.message).toContain("last-resort partial product API fill");
    expect(result.offers.some((offer) => offer.ingredientId === "chicken-thighs")).toBe(true);
  });

  it("returns error when Flipp, scrape, and API fallback all return zero", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [],
    });
    vi.spyOn(krogerFetcher, "fetchKrogerWeeklyAdPage").mockResolvedValue({
      html: "<html></html>",
      method: "http",
      attempts: 1,
      networkJsonBodies: [],
      browserFailed: true,
    });
    vi.spyOn(apiFallback, "fetchKrogerOffersFromOfficialApi").mockResolvedValue([]);

    const client = createKrogerWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      storeName: "Kroger",
      zipCode: "23111",
      trackedIngredientIds: ["chicken-thighs"],
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("Flipp syndicated feed");
    expect(result.message).toContain("last-resort product API fill");
  });
});
