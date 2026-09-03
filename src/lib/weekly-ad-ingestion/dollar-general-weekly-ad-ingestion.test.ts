import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDollarGeneralWeeklyAdIngestionClient } from "@/lib/weekly-ad-ingestion/dollar-general-weekly-ad-ingestion";
import * as flippResolver from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import * as pageFetcher from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("dollar general weekly ad ingestion", () => {
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

    const client = createDollarGeneralWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "dollar-general",
      storeId: "dollar-general-market-highland",
      storeName: "Dollar General Market",
      zipCode: "23111",
      trackedIngredientIds: [
        "spaghetti",
        "black-beans",
        "corn-tortillas",
        "olive-oil",
        "butter",
      ],
    });

    expect(flippSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("cached");
    expect(result.offers.some((offer) => offer.ingredientId === "spaghetti")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "black-beans")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "corn-tortillas")).toBe(
      true,
    );
    expect(result.offers.some((offer) => offer.ingredientId === "olive-oil")).toBe(
      true,
    );
    expect(
      result.offers.some(
        (offer) =>
          offer.ingredientId === "butter" &&
          /country crock/i.test(offer.productName),
      ),
    ).toBe(false);
    const matchedIds = new Set(
      result.offers
        .map((offer) => offer.ingredientId)
        .filter((ingredientId): ingredientId is string => Boolean(ingredientId)),
    );
    expect(matchedIds.size).toBeGreaterThanOrEqual(3);
  });

  it("loads live offers from Flipp when the page scrape is not needed", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [
        {
          productName: "Clover Valley Spaghetti",
          price: 1,
          saleLabel: "Directional — weekly ad syndicated feed",
        },
      ],
    });
    const pageSpy = vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent");

    const client = createDollarGeneralWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "dollar-general",
      storeId: "dollar-general-market-highland",
      storeName: "Dollar General Market",
      zipCode: "23111",
      trackedIngredientIds: ["spaghetti"],
    });

    expect(pageSpy).not.toHaveBeenCalled();
    expect(result.status).toBe("live");
    expect(result.provenance).toBe("weekly-ad-partner-feed");
    expect(result.message).toContain("area circular");
  });

  it("reports WAF blocking when Flipp and scrape both fail", async () => {
    vi.spyOn(flippResolver, "resolveFlippWeeklyAdOffersForChain").mockResolvedValue({
      retrievalLabel: "Flipp syndicated weekly-ad feed",
      rawOffers: [],
    });
    vi.spyOn(pageFetcher, "fetchWeeklyAdPageContent").mockRejectedValue(
      new Error("HTTP 403"),
    );

    const client = createDollarGeneralWeeklyAdIngestionClient();
    const result = await client.ingestWeeklyAd({
      chain: "dollar-general",
      storeId: "dollar-general-market-highland",
      storeName: "Dollar General Market",
      zipCode: "23111",
      trackedIngredientIds: ["spaghetti"],
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("HTTP 403");
    expect(result.message).toContain("Flipp syndicated feed also returned no offers");
  });
});
