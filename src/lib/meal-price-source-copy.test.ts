import { describe, expect, it } from "vitest";
import {
  buildMealPriceSourceSummary,
  buildResultsPanelPriceSourceLine,
} from "@/lib/meal-price-source-copy";
import { buildTestProviderCoverageRollup } from "@/lib/test-fixtures/contract-fixtures";

const baseMeal = {
  primaryStore: "Kroger Mechanicsville",
  storeCount: 1,
  explanation: "The meal fits the budget and keeps the trip simple.",
  shoppingPlan: [
    {
      ingredient: "Chicken thighs",
      quantityNote: "2 lb",
      storeName: "Kroger Mechanicsville",
      price: 6.49,
      freshnessDaysAgo: 1,
      saleConfidence: {
        level: "advertised-recent" as const,
        label: "Sale price — estimate only",
        note: "Saved store price.",
      },
    },
  ],
};

const baseMarket = {
  dataSource: "database" as const,
  providerCoverageRollup: buildTestProviderCoverageRollup(),
};

describe("buildMealPriceSourceSummary", () => {
  it("describes saved sale pricing in layman terms on the card", () => {
    const result = buildMealPriceSourceSummary({
      meal: baseMeal,
      market: baseMarket,
    });

    expect(result.summary).toBe(
      "Saved sale prices at Kroger Mechanicsville — not live checkout; confirm in store.",
    );
    expect(result.detail).toContain("saved sale prices");
    expect(result.summary).not.toMatch(/postgres|provenance|api|seed/i);
  });

  it("marks limited saved prices when sale confidence is weak", () => {
    const result = buildMealPriceSourceSummary({
      meal: {
        ...baseMeal,
        shoppingPlan: [
          {
            ...baseMeal.shoppingPlan[0],
            saleConfidence: {
              level: "directional-provider-match",
              label: "Estimated sale match — verify in store",
              note: "Directional match.",
            },
          },
        ],
      },
      market: baseMarket,
    });

    expect(result.summary).toMatch(/^Limited saved sale prices/);
  });

  it("uses multi-store phrasing when the plan spans stores", () => {
    const result = buildMealPriceSourceSummary({
      meal: {
        ...baseMeal,
        storeCount: 2,
        shoppingPlan: [
          baseMeal.shoppingPlan[0],
          {
            ...baseMeal.shoppingPlan[0],
            ingredient: "Broccoli",
            storeName: "Publix Midlothian",
          },
        ],
      },
      market: baseMarket,
    });

    expect(result.summary).toContain(
      "at Kroger Mechanicsville and Publix Midlothian",
    );
  });

  it("surfaces unavailable database copy without technical jargon", () => {
    const result = buildMealPriceSourceSummary({
      meal: baseMeal,
      market: {
        ...baseMarket,
        dataSource: "unavailable",
      },
    });

    expect(result.summary).toContain("unavailable");
    expect(result.summary).not.toMatch(/postgres|database/i);
  });
});

describe("buildResultsPanelPriceSourceLine", () => {
  it("returns a panel header line for saved sale pricing", () => {
    expect(buildResultsPanelPriceSourceLine(baseMarket)).toBe(
      "Dinner totals below use saved sale prices — not live checkout.",
    );
  });

  it("returns unavailable copy when saved prices cannot load", () => {
    expect(
      buildResultsPanelPriceSourceLine({
        dataSource: "unavailable",
        providerCoverageRollup: buildTestProviderCoverageRollup(),
      }),
    ).toBe(
      "Saved store prices are unavailable — meal totals below are estimates only.",
    );
  });
});
