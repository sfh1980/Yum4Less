import { describe, expect, it } from "vitest";
import { buildWeeklyAdPromotionReadiness } from "@/lib/weekly-ad-ingestion/weekly-ad-promotion-readiness";

describe("weekly ad promotion readiness", () => {
  it("marks Food Lion as promotable when gates pass, same as Aldi", () => {
    const foodLionReadiness = buildWeeklyAdPromotionReadiness({
      storeName: "Food Lion",
      chain: "food-lion",
      storeId: "food-lion-mechanicsville",
      coverage: {
        storeId: "food-lion-mechanicsville",
        chain: "food-lion",
        matchedIngredientCount: 6,
        totalRecipeIngredientCount: 6,
        averageMatchConfidence: 0.9,
        maxFreshnessHoursAgo: 0,
        maxFreshnessDaysAgo: 0,
        coverageStatus: "strong",
        usesWeeklyAdSource: true,
      },
    });

    expect(foodLionReadiness.overallStatus).toBe("ready");
    expect(foodLionReadiness.weeklyAdRankedPricingEnabled).toBe(true);

    const aldiReadiness = buildWeeklyAdPromotionReadiness({
      storeName: "Aldi",
      chain: "aldi",
      storeId: "aldi-mechanicsville",
      coverage: {
        storeId: "aldi-mechanicsville",
        chain: "aldi",
        matchedIngredientCount: 6,
        totalRecipeIngredientCount: 6,
        averageMatchConfidence: 0.9,
        maxFreshnessHoursAgo: 0,
        maxFreshnessDaysAgo: 0,
        coverageStatus: "strong",
        usesWeeklyAdSource: true,
      },
    });

    expect(aldiReadiness.weeklyAdRankedPricingEnabled).toBe(true);
    expect(aldiReadiness.overallStatus).not.toBe("not-applicable");
  });

  it("does not mark Dollar General ready when another ranked grocer is nearby", () => {
    const coverage = {
      storeId: "dollar-general-market-highland",
      chain: "dollar-general" as const,
      matchedIngredientCount: 6,
      totalRecipeIngredientCount: 6,
      averageMatchConfidence: 0.9,
      maxFreshnessHoursAgo: 0,
      maxFreshnessDaysAgo: 0,
      coverageStatus: "strong" as const,
      usesWeeklyAdSource: true,
    };
    const desert = buildWeeklyAdPromotionReadiness({
      storeName: "Dollar General Market",
      chain: "dollar-general",
      storeId: "dollar-general-market-highland",
      coverage,
      nearbyChains: ["dollar-general"],
    });
    const mixed = buildWeeklyAdPromotionReadiness({
      storeName: "Dollar General Market",
      chain: "dollar-general",
      storeId: "dollar-general-market-highland",
      coverage,
      nearbyChains: ["kroger", "dollar-general"],
    });

    expect(desert.weeklyAdRankedPricingEnabled).toBe(true);
    expect(mixed.weeklyAdRankedPricingEnabled).toBe(false);
  });
});
