import { describe, expect, it } from "vitest";
import {
  analyzeWeeklyAdMatchFunnel,
  probeWeeklyAdOfferMatch,
} from "@/lib/weekly-ad-ingestion/weekly-ad-match-funnel-analysis";
import { MIN_WEEKLY_AD_MATCH_CONFIDENCE } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";

describe("weekly ad match funnel analysis", () => {
  it("classifies matched vs below-threshold vs noise offers", () => {
    const funnel = analyzeWeeklyAdMatchFunnel({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      sourceUrl: "https://example.com/weekly-ad",
      observedAt: "2026-06-28T00:00:00.000Z",
      rawOffers: [
        { productName: "Kroger 73% Lean Ground Beef", price: 5.99 },
        { productName: "Chobani Greek Yogurt", price: 1.25 },
        { productName: "Coca-Cola", price: 2.99 },
      ],
      trackedIngredientIds: ["ground-beef", "plain-yogurt"],
    });

    expect(funnel.matchedCount).toBe(2);
    expect(funnel.belowThresholdCount).toBe(0);
    expect(funnel.noCandidateCount).toBe(1);

    const yogurtProbe = funnel.probes.find(
      (probe) => probe.productName === "Chobani Greek Yogurt",
    );
    expect(yogurtProbe?.outcome).toBe("matched");
    expect(yogurtProbe?.matchedIngredientId).toBe("plain-yogurt");
    expect(yogurtProbe?.bestConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);

    const sodaProbe = funnel.probes.find((probe) => probe.productName === "Coca-Cola");
    expect(sodaProbe?.bestConfidence).toBeLessThanOrEqual(0.05);
  });

  it("reports guard rejections separately from no-candidate offers", () => {
    const probe = probeWeeklyAdOfferMatch({
      chain: "walmart",
      rawOffer: { productName: "Lay's Classic Potato Chips", price: 2.5 },
      trackedIngredientIds: ["baby-potatoes"],
    });

    expect(probe.outcome).toBe("guard_rejected_only");
    expect(probe.guardRejectedIngredientIds).toContain("baby-potatoes");
    expect(probe.matchedIngredientId).toBeUndefined();
  });
});
