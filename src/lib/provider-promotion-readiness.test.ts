import { describe, expect, it } from "vitest";
import {
  buildAllProviderPromotionReadiness,
  buildProviderPromotionReadiness,
} from "@/lib/provider-promotion-readiness";
import type { ProviderCoverageRollup } from "@/lib/provider-coverage-rollup";
import type { ProviderPricingPreviewResult } from "@/lib/providers/provider-types";

function buildRollup(
  overrides: Partial<ProviderCoverageRollup> = {},
): ProviderCoverageRollup {
  return {
    overallCoverageStatus: "none",
    trustGate: "not-available",
    rankedPricingSource: "none",
    totalTrackedIngredients: 5,
    matchedIngredientCount: 0,
    unmatchedIngredientCount: 5,
    averageMatchConfidence: null,
    usesCachedPreview: false,
    ingredientSummaries: [],
    message: "No preview.",
    ...overrides,
  };
}

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

describe("buildProviderPromotionReadiness", () => {
  it("blocks promotion when preview coverage is unavailable", () => {
    const readiness = buildProviderPromotionReadiness({
      provider: "kroger",
      coverageRollup: buildRollup(),
      preview: undefined,
    });

    expect(readiness.overallStatus).toBe("blocked");
    expect(readiness.recommendationPricingPromotionEnabled).toBe(false);
    expect(readiness.message).toContain("Kroger");
    expect(readiness.gates.find((gate) => gate.id === "mvp-promotion-lock")?.passed).toBe(
      false,
    );
  });

  it("marks limited monitoring coverage as not-ready with provider-aware gate notes", () => {
    const readiness = buildProviderPromotionReadiness({
      provider: "kroger",
      coverageRollup: buildRollup({
        trustGate: "monitoring",
        overallCoverageStatus: "limited",
        matchedIngredientCount: 2,
        unmatchedIngredientCount: 3,
        averageMatchConfidence: 0.62,
      }),
      preview: buildPreview({
        matchedIngredientCount: 2,
        coverageStatus: "limited",
        provenance: "fallback-local",
        retrievalMode: "none",
        configured: true,
      }),
    });

    expect(readiness.overallStatus).toBe("not-ready");
    expect(readiness.recommendationPricingPromotionEnabled).toBe(false);
    expect(readiness.message).toContain("ingested cache rows only");
    expect(
      readiness.gates.find((gate) => gate.id === "provider-configured")?.note,
    ).toContain("Kroger");
  });

  it("reports ready-but-disabled when technical gates pass but the MVP lock remains", () => {
    const readiness = buildProviderPromotionReadiness({
      provider: "kroger",
      coverageRollup: buildRollup({
        trustGate: "monitoring",
        overallCoverageStatus: "strong",
        matchedIngredientCount: 5,
        unmatchedIngredientCount: 0,
        averageMatchConfidence: 0.88,
      }),
      preview: buildPreview({
        matchedIngredientCount: 5,
        coverageStatus: "strong",
        items: [
          {
            provider: "kroger",
            ingredientId: "chicken-thighs",
            ingredientName: "Chicken thighs",
            providerProductId: "0001111000001",
            description: "Fresh Chicken Thighs Family Pack",
            regularPrice: 6.49,
            inStock: true,
            matchConfidence: 0.88,
            matchReason: "description contains the full ingredient name",
          },
        ],
      }),
    });

    expect(readiness.overallStatus).toBe("ready-but-disabled");
    expect(readiness.recommendationPricingPromotionEnabled).toBe(false);
    expect(readiness.gatesPassedCount).toBe(5);
    expect(readiness.gatesTotalCount).toBe(6);
    expect(readiness.message).toContain("ingested cache rows rather than provider preview data");
  });

  it("does not treat cached preview data as live promotion-ready", () => {
    const readiness = buildProviderPromotionReadiness({
      provider: "kroger",
      coverageRollup: buildRollup({
        trustGate: "monitoring",
        overallCoverageStatus: "strong",
        matchedIngredientCount: 5,
        unmatchedIngredientCount: 0,
        averageMatchConfidence: 0.88,
        usesCachedPreview: true,
      }),
      preview: buildPreview({
        status: "fallback",
        retrievalMode: "cached",
        fallbackUsed: true,
        matchedIngredientCount: 5,
        coverageStatus: "strong",
      }),
    });

    expect(readiness.overallStatus).toBe("approaching");
    expect(
      readiness.gates.find((gate) => gate.id === "live-preview-data")?.passed,
    ).toBe(false);
  });
});

describe("buildAllProviderPromotionReadiness", () => {
  it("returns promotion readiness for every registered provider", () => {
    const readiness = buildAllProviderPromotionReadiness({
      previews: [
        buildPreview(),
        buildPreview({
          provider: "publix",
          label: "Publix official pricing preview",
          status: "not-configured",
          provenance: "not-configured",
          retrievalMode: "none",
          configured: false,
        }),
        buildPreview({
          provider: "walmart",
          label: "Walmart official pricing preview",
          status: "not-configured",
          provenance: "not-configured",
          retrievalMode: "none",
          configured: false,
        }),
      ],
    });

    expect(readiness.map((entry) => entry.provider)).toEqual([
      "kroger",
      "publix",
      "walmart",
    ]);
    expect(readiness.every((entry) => !entry.recommendationPricingPromotionEnabled)).toBe(
      true,
    );
  });
});
