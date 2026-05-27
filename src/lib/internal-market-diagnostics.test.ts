import { describe, expect, it } from "vitest";
import { buildInternalMarketDiagnosticLines } from "@/lib/internal-market-diagnostics";
import type { MarketSummary } from "@/lib/recommendation-service";

function minimalMarket(overrides: Partial<MarketSummary> = {}): MarketSummary {
  return {
    locationLabel: "Mechanicsville, VA",
    searchLatitude: 37.6,
    searchLongitude: -77.3,
    radiusMiles: 5,
    nearbyStores: [],
    recommendationReadyStoreCount: 0,
    providerRollout: [],
    providerStoreSearches: [],
    providerPricingPreviews: [],
    providerCoverageRollup: {
      providers: [],
      averageMatchConfidence: null,
      matchedIngredientCount: 0,
      unmatchedIngredientCount: 0,
      totalTrackedIngredients: 0,
      overallCoverageStatus: "none",
      rankedPricingSource: "none",
      trustGate: "not-available",
      usesCachedPreview: false,
      ingredientSummaries: [],
      message: "No preview.",
    },
    providerPromotionReadiness: [],
    providerPriceObservationSync: [],
    weeklyAdIngestionStatus: [],
    weeklyAdPromotionReadiness: [],
    lookupSource: "seed",
    lookupProviderConfigured: false,
    dataSource: "database",
    ...overrides,
  };
}

describe("buildInternalMarketDiagnosticLines", () => {
  it("summarizes structured market state without a legacy message blob", () => {
    const lines = buildInternalMarketDiagnosticLines(
      minimalMarket({ recommendationReadyStoreCount: 2 }),
    );

    expect(lines[0]).toContain("2 recommendation-ready");
    expect(lines.some((line) => line.includes("GEOCODIO"))).toBe(true);
  });
});
