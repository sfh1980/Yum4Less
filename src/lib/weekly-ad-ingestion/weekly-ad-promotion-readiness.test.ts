import { describe, expect, it } from "vitest";
import { buildWeeklyAdPromotionReadiness } from "@/lib/weekly-ad-ingestion/weekly-ad-promotion-readiness";

describe("weekly ad promotion readiness", () => {
  it("marks Aldi and Food Lion as not-applicable for weekly-ad ranked pricing", () => {
    for (const chain of ["aldi", "food-lion"] as const) {
      const readiness = buildWeeklyAdPromotionReadiness({
        storeName: chain === "aldi" ? "Aldi" : "Food Lion",
        chain,
        storeId: `${chain}-mechanicsville`,
        coverage: {
          storeId: `${chain}-mechanicsville`,
          chain,
          matchedIngredientCount: 6,
          totalRecipeIngredientCount: 6,
          averageMatchConfidence: 0.9,
          maxFreshnessDaysAgo: 0,
          coverageStatus: "strong",
          usesWeeklyAdSource: true,
        },
      });

      expect(readiness.overallStatus).toBe("not-applicable");
      expect(readiness.weeklyAdRankedPricingEnabled).toBe(false);
      expect(readiness.message).toContain("outside the current weekly-ad ranked-pricing rollout");
    }
  });
});
