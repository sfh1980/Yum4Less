import { describe, expect, it } from "vitest";
import { buildPricingTrustHeadsUp } from "@/lib/pricing-trust-heads-up";
import { buildTestMarketSummaryPick, buildTestProviderCoverageRollup } from "@/lib/test-fixtures/contract-fixtures";

const baseMarket = buildTestMarketSummaryPick(
  [
    "providerStoreSearches",
    "providerPricingPreviews",
    "providerCoverageRollup",
    "lookupSource",
    "dataSource",
    "lookupProviderConfigured",
    "recommendationReadyStoreCount",
  ],
  {
    providerCoverageRollup: buildTestProviderCoverageRollup({ rankedPricingSource: "none" }),
    lookupSource: "geocodio",
    lookupProviderConfigured: true,
    recommendationReadyStoreCount: 0,
  },
);

describe("buildPricingTrustHeadsUp", () => {
  it("returns null when no store context exists", () => {
    expect(buildPricingTrustHeadsUp(baseMarket)).toBeNull();
  });

  it("returns trust baseline when store searches exist without fallback signals", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      providerStoreSearches: [
        {
          fallbackUsed: false,
        } as (typeof baseMarket)["providerStoreSearches"][number],
      ],
    });

    expect(headsUp?.title).toBe("Heads up about these prices");
    expect(headsUp?.message).toContain("Meal prices are estimates");
    expect(headsUp?.message).toContain("not live checkout");
    expect(headsUp?.message).toContain("estimates");
  });

  it("surfaces provider fallbackUsed in layman copy", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      providerPricingPreviews: [
        {
          fallbackUsed: true,
        } as (typeof baseMarket)["providerPricingPreviews"][number],
      ],
    });

    expect(headsUp?.title).toBe("Heads up about these prices");
    expect(headsUp?.message).toContain("backup data");
    expect(headsUp?.message).toContain("estimates");
    expect(headsUp?.message).toContain("Meal prices are estimates");
  });

  it("surfaces non-live ranked pricing when stores are recommendation-ready", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      recommendationReadyStoreCount: 1,
      providerCoverageRollup: {
        ...baseMarket.providerCoverageRollup,
        rankedPricingSource: "weekly-ad-cache",
      },
    });

    expect(headsUp?.message).toContain("saved store prices from ads and online checks");
  });

  it("surfaces limited ZIP lookup fallback", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      lookupSource: "seed",
    });

    expect(headsUp?.message).toContain("limited local ZIP list");
  });

  it("surfaces database unavailable state", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      dataSource: "unavailable",
    });

    expect(headsUp?.message).toContain("could not load saved store prices");
  });
});
