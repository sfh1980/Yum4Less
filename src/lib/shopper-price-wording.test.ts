import { describe, expect, it } from "vitest";
import {
  formatShopperPriceClause,
  formatShopperPriceWording,
  formatShopperTotalWording,
  shopperPriceTierFromOfferFields,
  shopperPriceTierFromSaleConfidenceLevel,
  shopperPriceTierFromShoppingPlan,
} from "@/lib/shopper-price-wording";

describe("shopperPriceTierFromSaleConfidenceLevel", () => {
  it("maps advertised-recent to high", () => {
    expect(shopperPriceTierFromSaleConfidenceLevel("advertised-recent")).toBe(
      "high",
    );
  });

  it("maps advertised-aging to medium", () => {
    expect(shopperPriceTierFromSaleConfidenceLevel("advertised-aging")).toBe(
      "medium",
    );
  });

  it("maps directional-provider-match to low (weak match — no bare dollar claim)", () => {
    expect(
      shopperPriceTierFromSaleConfidenceLevel("directional-provider-match"),
    ).toBe("low");
  });

  it("maps stale / regular / unavailable-class levels to low", () => {
    expect(shopperPriceTierFromSaleConfidenceLevel("advertised-stale")).toBe(
      "low",
    );
    expect(shopperPriceTierFromSaleConfidenceLevel("regular-price")).toBe("low");
    expect(shopperPriceTierFromSaleConfidenceLevel("no-sale-data")).toBe("low");
  });
});

describe("shopperPriceTierFromShoppingPlan", () => {
  it("uses the worst priced line", () => {
    expect(
      shopperPriceTierFromShoppingPlan([
        { saleConfidence: { level: "advertised-recent" } },
        { saleConfidence: { level: "directional-provider-match" } },
      ]),
    ).toBe("low");
  });

  it("ignores pantry lines", () => {
    expect(
      shopperPriceTierFromShoppingPlan([
        {
          sourcedFromPantry: true,
          saleConfidence: { level: "directional-provider-match" },
        },
        { saleConfidence: { level: "advertised-recent" } },
      ]),
    ).toBe("high");
  });
});

describe("formatShopperPriceWording", () => {
  it("calls every tier an estimate and suppresses a bare dollar on low", () => {
    expect(formatShopperPriceWording(13.42, "high")).toBe(
      "Estimated lowest price: $13.42",
    );
    expect(formatShopperPriceWording(6.49, "medium")).toBe(
      "Estimated lowest price from an older ad: $6.49",
    );
    expect(formatShopperPriceWording(2.1, "low")).toBe(
      "Estimated price — worth verifying in store",
    );
    expect(formatShopperPriceWording(13.42, "high")).toMatch(/estimated/i);
    expect(formatShopperPriceWording(6.49, "medium")).toMatch(/estimated/i);
    expect(formatShopperPriceWording(2.1, "low")).toMatch(/estimated/i);
    expect(formatShopperPriceWording(2.1, "low")).not.toMatch(/\$/);
    expect(formatShopperPriceWording(13.42, "high")).not.toMatch(/Lowest price we found/);
  });

  it("labels dinner totals and store subtotals as an estimated total", () => {
    expect(formatShopperTotalWording(13.42, "high")).toBe(
      "Estimated total: about $13.42",
    );
    expect(formatShopperTotalWording(6.49, "medium")).toBe(
      "Estimated total: about $6.49",
    );
    expect(formatShopperTotalWording(2.1, "low")).toBe(
      "Estimated total - worth verifying in store",
    );
    expect(formatShopperTotalWording(2.1, "low")).not.toMatch(/\$/);
  });

  it("fits the shopping-plan line as one sentence", () => {
    const line = `Spinach from Publix (Brandy Creek Commons) for ${formatShopperPriceClause(1.99, "high")} (1 bunch).`;
    expect(line).toBe(
      "Spinach from Publix (Brandy Creek Commons) for an estimated lowest price of $1.99 (1 bunch).",
    );
    expect(
      `Spinach from Publix for ${formatShopperPriceClause(1.99, "medium")} (1 bunch).`,
    ).toContain("from an older ad");
    expect(formatShopperPriceClause(2.1, "low")).toBe(
      "an estimated price worth verifying in store",
    );
    expect(formatShopperPriceClause(2.1, "low")).not.toMatch(/\$/);
  });
});

describe("shopperPriceTierFromOfferFields", () => {
  it("treats weak Kroger official matches as low", () => {
    expect(
      shopperPriceTierFromOfferFields({
        freshnessDaysAgo: 0,
        freshnessHoursAgo: 1,
        priceSource: "kroger-official-api",
        matchConfidence: 0.55,
        saleLabel: "Promo",
      }),
    ).toBe("low");
  });

  it("treats strong recent official matches as high", () => {
    expect(
      shopperPriceTierFromOfferFields({
        freshnessDaysAgo: 0,
        freshnessHoursAgo: 1,
        priceSource: "kroger-official-api",
        matchConfidence: 0.9,
        saleLabel: "Promo",
      }),
    ).toBe("high");
  });
});
