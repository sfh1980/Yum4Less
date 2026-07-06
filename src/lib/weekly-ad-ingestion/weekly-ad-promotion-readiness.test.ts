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
});
