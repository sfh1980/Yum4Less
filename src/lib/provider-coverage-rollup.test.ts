import { describe, expect, it } from "vitest";
import { buildProviderCoverageRollup } from "@/lib/provider-coverage-rollup";
import type { ProviderPricingPreviewResult } from "@/lib/providers/provider-types";

function buildPreview(
  overrides: Partial<ProviderPricingPreviewResult> = {},
): ProviderPricingPreviewResult {
  return {
    provider: "kroger",
    label: "Kroger official pricing preview",
    status: "available",
    provenance: "official-api",
    retrievalMode: "live",
    configured: true,
    fallbackUsed: false,
    storeName: "Kroger Mechanicsville",
    providerStoreId: "01100479",
    items: [],
    coverageStatus: "none",
    matchedIngredientCount: 0,
    totalTrackedIngredients: 5,
    message: "Preview unavailable.",
    fetchedAt: "2026-05-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildProviderCoverageRollup", () => {
  it("returns a not-available rollup when no preview exists", () => {
    const rollup = buildProviderCoverageRollup([]);

    expect(rollup.trustGate).toBe("not-available");
    expect(rollup.overallCoverageStatus).toBe("none");
    expect(rollup.rankedPricingSource).toBe("none");
    expect(rollup.ingredientSummaries).toHaveLength(5);
    expect(rollup.message).toContain(
      "No eligible ingested price observations are available yet",
    );
  });

  it("closes the trust gate when preview coverage is weak", () => {
    const rollup = buildProviderCoverageRollup([
      buildPreview({
        matchedIngredientCount: 1,
        coverageStatus: "weak",
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            regularPrice: 6.49,
            currencyCode: "USD",
            inStock: true,
            matchConfidence: 0.88,
            matchReason: "description contains the full ingredient name",
          },
        ],
      }),
    ]);

    expect(rollup.trustGate).toBe("closed");
    expect(rollup.overallCoverageStatus).toBe("weak");
    expect(rollup.matchedIngredientCount).toBe(1);
    expect(rollup.unmatchedIngredientCount).toBe(4);
    expect(rollup.averageMatchConfidence).toBe(0.88);
  });

  it("enters monitoring mode for limited coverage and lists unmatched ingredients", () => {
    const rollup = buildProviderCoverageRollup([
      buildPreview({
        matchedIngredientCount: 2,
        coverageStatus: "limited",
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            inStock: true,
            matchConfidence: 0.88,
            matchReason: "description contains the full ingredient name",
          },
          {
            provider: "kroger",
            ingredientId: "baby-potatoes",
            ingredientName: "Baby potatoes",
            providerProductId: "0001111000002",
            description: "Baby Gold Potatoes",
            inStock: true,
            matchConfidence: 0.72,
            matchReason: "matched ingredient tokens: baby, potatoes",
          },
        ],
      }),
    ]);

    expect(rollup.trustGate).toBe("monitoring");
    expect(rollup.overallCoverageStatus).toBe("limited");
    expect(rollup.ingredientSummaries.filter((summary) => !summary.matched)).toHaveLength(3);
    expect(rollup.message).toContain("informational only");
    expect(rollup.message).toContain(
      "No eligible ingested price observations are available yet",
    );
  });

  it("uses DB-backed tracked ingredient breadth when provided", () => {
    const trackedIngredients = Array.from({ length: 97 }, (_, index) => ({
      ingredientId: `ingredient-${index}`,
      ingredientName: `Ingredient ${index}`,
      searchTerm: `Ingredient ${index}`,
    }));

    const rollup = buildProviderCoverageRollup(
      [
        buildPreview({
          matchedIngredientCount: 10,
          totalTrackedIngredients: 97,
          coverageStatus: "weak",
        }),
      ],
      "none",
      trackedIngredients,
    );

    expect(rollup.totalTrackedIngredients).toBe(97);
    expect(rollup.ingredientSummaries).toHaveLength(97);
    expect(rollup.matchedIngredientCount).toBe(0);
    expect(rollup.unmatchedIngredientCount).toBe(97);
  });

  it("marks cached previews separately in the rollup message", () => {
    const rollup = buildProviderCoverageRollup([
      buildPreview({
        status: "fallback",
        retrievalMode: "cached",
        fallbackUsed: true,
        matchedIngredientCount: 2,
        coverageStatus: "limited",
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            inStock: true,
            matchConfidence: 0.88,
            matchReason: "description contains the full ingredient name",
          },
          {
            provider: "kroger",
            ingredientId: "baby-potatoes",
            ingredientName: "Baby potatoes",
            providerProductId: "0001111000002",
            description: "Baby Gold Potatoes",
            inStock: true,
            matchConfidence: 0.72,
            matchReason: "matched ingredient tokens: baby, potatoes",
          },
        ],
      }),
    ]);

    expect(rollup.usesCachedPreview).toBe(true);
    expect(rollup.message).toContain("saved provider preview snapshot");
  });
});
