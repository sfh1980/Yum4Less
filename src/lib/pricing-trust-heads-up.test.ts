import { describe, expect, it } from "vitest";
import { buildPricingTrustHeadsUp } from "@/lib/pricing-trust-heads-up";

const baseMarket = {
  providerStoreSearches: [],
  providerPricingPreviews: [],
  providerCoverageRollup: {
    rankedPricingSource: "none" as const,
  },
  lookupSource: "geocodio" as const,
  dataSource: "database" as const,
  lookupProviderConfigured: true,
  recommendationReadyStoreCount: 0,
};

describe("buildPricingTrustHeadsUp", () => {
  it("returns null when no store context exists", () => {
    expect(buildPricingTrustHeadsUp(baseMarket)).toBeNull();
  });

  it("returns beta baseline when store searches exist without fallback signals", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      providerStoreSearches: [
        {
          fallbackUsed: false,
        } as (typeof baseMarket)["providerStoreSearches"][number],
      ],
    });

    expect(headsUp?.title).toBe("Beta — heads up about these prices");
    expect(headsUp?.message).toContain("Yum4Less is in beta");
    expect(headsUp?.message).toContain("not every nearby chain is live-priced");
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

    expect(headsUp?.title).toBe("Beta — heads up about these prices");
    expect(headsUp?.message).toContain("backup data");
    expect(headsUp?.message).toContain("estimates");
    expect(headsUp?.message).toContain("Yum4Less is in beta");
  });

  it("surfaces non-live ranked pricing when stores are recommendation-ready", () => {
    const headsUp = buildPricingTrustHeadsUp({
      ...baseMarket,
      recommendationReadyStoreCount: 1,
      providerCoverageRollup: {
        rankedPricingSource: "weekly-ad-cache",
      },
    });

    expect(headsUp?.message).toContain("recently checked online store prices");
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
