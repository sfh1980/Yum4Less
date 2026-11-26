import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWalmartWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-ingestion";
import * as flippResolver from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import * as walmartFetcher from "@/lib/weekly-ad-ingestion/walmart-weekly-ad-fetcher";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("walmart weekly ad ingestion", () => {
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

    const client = createWalmartWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23111",
      trackedIngredientIds: ["bananas", "peanut-butter"],
    });

    expect(flippSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("cached");
  });

  it("skips walmart.com scrape when Flipp returns offers", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      noCurrentFlyer: false,
      rawOffers: [
        {
          productName: "Fresh Bananas",
          price: 0.49,
          saleLabel: "Directional — weekly ad syndicated feed",
        },
        {
          productName: "Great Value Peanut Butter",
          price: 2.98,
        },
      ],
    });
    const pageSpy = vi.spyOn(walmartFetcher, "fetchWalmartWeeklyAdPage");

    const client = createWalmartWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23111",
      trackedIngredientIds: ["bananas"],
    });

    expect(pageSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-partner-feed");
    expect(result.message).toContain("Flipp syndicated weekly-ad feed");
  });

  it("falls back to Walmart page scrape only when Flipp is empty", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      noCurrentFlyer: false,
      rawOffers: [],
    });
    const pageSpy = vi
      .spyOn(walmartFetcher, "fetchWalmartWeeklyAdPage")
      .mockResolvedValue({
        html: `<script id="weekly-ad-offers-data">[{"productName":"Great Value Bread","price":1.28}]</script>`,
        method: "browser" as const,
        networkJsonBodies: [],
        waitSelectorMatched: true,
        attempts: 1,
      });

    const client = createWalmartWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23111",
      trackedIngredientIds: ["bread"],
    });

    expect(pageSpy).toHaveBeenCalledOnce();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-scrape");
    expect(result.message).toContain("browser scrape");
  });

  it("reports captcha/WAF when Flipp and scrape both fail", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      noCurrentFlyer: true,
      rawOffers: [],
    });
    vi.spyOn(walmartFetcher, "fetchWalmartWeeklyAdPage").mockRejectedValue(
      new Error("Robot or human? captcha"),
    );

    const client = createWalmartWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23111",
      trackedIngredientIds: ["bananas"],
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("captcha");
    expect(result.message).toContain("Flipp syndicated feed also returned no offers");
    expect(result.noFlyer).not.toBe(true);
  });

  it("records no flyer when Flipp proved none and the page loaded without an ad", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      noCurrentFlyer: true,
      rawOffers: [],
    });
    vi.spyOn(walmartFetcher, "fetchWalmartWeeklyAdPage").mockResolvedValue({
      html: "<!doctype html><html><body><p>No weekly ad this week.</p></body></html>",
      method: "http",
      networkJsonBodies: [],
      waitSelectorMatched: false,
      attempts: 1,
    });

    const client = createWalmartWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23005",
      trackedIngredientIds: ["bananas"],
    });

    expect(result.status).toBe("live");
    expect(result.noFlyer).toBe(true);
    expect(result.offers).toEqual([]);
    expect(result.message).toContain("no current or upcoming flyer");
    expect(result.message).not.toContain("could not load");
  });

  it("stays an error when the page is empty or blocked even if Flipp had no flyer", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      noCurrentFlyer: true,
      rawOffers: [],
    });
    vi.spyOn(walmartFetcher, "fetchWalmartWeeklyAdPage").mockResolvedValue({
      html: "",
      method: "http",
      networkJsonBodies: [],
      waitSelectorMatched: false,
      attempts: 1,
      browserFailed: true,
    });

    const client = createWalmartWeeklyAdIngestionClient();
    const emptyPage = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23005",
      trackedIngredientIds: ["bananas"],
    });
    expect(emptyPage.status).toBe("error");
    expect(emptyPage.noFlyer).not.toBe(true);
    expect(emptyPage.message).toContain("could not load");

    vi.spyOn(walmartFetcher, "fetchWalmartWeeklyAdPage").mockResolvedValue({
      html: "<!doctype html><html><body>Robot or human? captcha</body></html>",
      method: "browser",
      networkJsonBodies: [],
      waitSelectorMatched: false,
      attempts: 1,
    });
    const blocked = await client.ingestWeeklyAd({
      chain: "walmart",
      storeId: "walmart-mechanicsville",
      storeName: "Walmart",
      zipCode: "23005",
      trackedIngredientIds: ["bananas"],
    });
    expect(blocked.status).toBe("error");
    expect(blocked.noFlyer).not.toBe(true);
  });
});
