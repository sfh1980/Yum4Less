import { describe, expect, it } from "vitest";
import {
  adPriceForYourAreaAt,
  buildMealPriceSourceSummary,
  buildResultsPanelPriceSourceLine,
  shopperVisibleSaleLabel,
} from "@/lib/meal-price-source-copy";
import { weeklyAdFlyerContentHash } from "@/lib/weekly-ad-ingestion/weekly-ad-flyer-hash";
import { buildTestProviderCoverageRollup } from "@/lib/test-fixtures/contract-fixtures";

const baseMeal = {
  primaryStore: "Kroger Mechanicsville",
  storeCount: 1,
  explanation: "The meal fits the budget and keeps the trip simple.",
  shoppingPlan: [
    {
      ingredient: "Chicken thighs",
      ingredientId: "chicken-thighs",
      quantityNote: "2 lb",
      storeName: "Kroger Mechanicsville",
      price: 6.49,
      freshnessDaysAgo: 1,
      sourcedFromPantry: false,
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
      "Ad price for your area at Kroger Mechanicsville - confirm in store.",
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

    expect(result.summary).toBe(
      "Limited coverage — ad price for your area at Kroger Mechanicsville - confirm in store.",
    );
  });

  it("uses the shelf sentence for a store price", () => {
    const result = buildMealPriceSourceSummary({
      meal: baseMeal,
      market: {
        ...baseMarket,
        providerCoverageRollup: buildTestProviderCoverageRollup({
          rankedPricingSource: "official-api-cache",
        }),
      },
    });

    expect(result.summary).toBe(
      "Store price at Kroger Mechanicsville - confirm at the shelf.",
    );
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
            ingredientId: "broccoli",
            storeName: "Publix Midlothian",
            sourcedFromPantry: false,
          },
        ],
      },
      market: baseMarket,
    });

    expect(result.summary).toBe(
      "Ad price for your area at Kroger Mechanicsville and Publix Midlothian - confirm in store.",
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

  it("shows the shared sentence for a Flipp fallback label and leaves the flyer hash on the stored label", () => {
    const stored = "Flipp flyer · Publix";
    const visible = shopperVisibleSaleLabel(stored, "Publix Virginia Center");
    expect(visible).toBe(adPriceForYourAreaAt("Publix Virginia Center"));
    expect(visible).toBe(
      "Ad price for your area at Publix Virginia Center - confirm in store.",
    );
    expect(shopperVisibleSaleLabel("Flipp flyer · GreenWise", "Publix Midlothian")).toBe(
      "Ad price for your area at Publix Midlothian - confirm in store.",
    );
    expect(
      shopperVisibleSaleLabel(
        "Directional — BOGO (save up to, not shelf price)",
        "Publix Virginia Center",
      ),
    ).toBe("Directional — BOGO (save up to, not shelf price)");
    const storedHash = weeklyAdFlyerContentHash([
      { productName: "Chicken", price: 3, saleLabel: stored },
    ]);
    const visibleHash = weeklyAdFlyerContentHash([
      { productName: "Chicken", price: 3, saleLabel: visible ?? "" },
    ]);
    expect(storedHash).not.toBe(visibleHash);
  });
});
