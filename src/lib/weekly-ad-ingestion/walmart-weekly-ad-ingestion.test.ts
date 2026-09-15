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
  });
});
