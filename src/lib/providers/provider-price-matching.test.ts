import { describe, expect, it } from "vitest";
import {
  buildPricingCoverageMessage,
  getPricingCoverageStatus,
  scoreProviderProductMatch,
} from "@/lib/providers/provider-price-matching";

describe("provider price matching", () => {
  it("scores clear ingredient-name matches above the acceptance threshold", () => {
    const match = scoreProviderProductMatch({
      ingredient: {
        ingredientId: "chicken-thighs",
        ingredientName: "Chicken thighs",
        searchTerm: "Chicken thighs",
      },
      description: "Fresh Chicken Thighs Family Pack",
      inStock: true,
    });

    expect(match.matchConfidence).toBeGreaterThanOrEqual(0.45);
    expect(match.matchReason).toContain("description contains the full ingredient name");
  });

  it("matches cabbage aliases in weekly-ad product titles", () => {
    const match = scoreProviderProductMatch({
      ingredient: {
        ingredientId: "cabbage",
        ingredientName: "Green cabbage",
        searchTerm: "cabbage",
      },
      description: "Fresh Green Cabbage Head",
      inStock: true,
    });

    expect(match.matchConfidence).toBeGreaterThanOrEqual(0.45);
  });

  it("rejects black-only furniture matches for black beans", () => {
    const match = scoreProviderProductMatch({
      ingredient: {
        ingredientId: "black-beans",
        ingredientName: "Black beans",
        searchTerm: "black beans",
      },
      description: "Mainstays Albany Lane 5-Piece Steel Outdoor Patio Dining Set, Black",
      inStock: true,
    });

    expect(match.matchConfidence).toBeLessThan(0.45);
  });

  it("marks partial tracked-ingredient coverage as limited", () => {
    const coverageStatus = getPricingCoverageStatus({
      matchedIngredientCount: 2,
      totalTrackedIngredients: 5,
    });

    expect(coverageStatus).toBe("limited");
    expect(
      buildPricingCoverageMessage({
        matchedIngredientCount: 2,
        totalTrackedIngredients: 5,
        coverageStatus,
      }),
    ).toContain("not used for ranked meal pricing");
  });
});
