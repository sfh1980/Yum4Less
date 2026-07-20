import { describe, expect, it } from "vitest";
import {
  formatShopperPriceWording,
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
  it("flexes copy by tier and suppresses bare $ for low", () => {
    expect(formatShopperPriceWording(13.42, "high")).toBe(
      "Lowest price we found: $13.42",
    );
    expect(formatShopperPriceWording(6.49, "medium")).toBe(
      "Estimated lowest price: $6.49",
    );
    expect(formatShopperPriceWording(2.1, "low")).toBe(
      "Price estimate — worth verifying in store",
    );
    expect(formatShopperPriceWording(2.1, "low")).not.toMatch(/\$/);
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
