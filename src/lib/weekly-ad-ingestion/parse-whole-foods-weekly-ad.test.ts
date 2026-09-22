import { describe, expect, it } from "vitest";
import {
  parseWholeFoodsOfferPrice,
  parseWholeFoodsWeeklyAd,
} from "@/lib/weekly-ad-ingestion/parse-whole-foods-weekly-ad";

describe("parseWholeFoodsWeeklyAd", () => {
  it("extracts unit-priced promotions and skips percent-only lines", () => {
    const offers = parseWholeFoodsWeeklyAd({
      promotions: [
        {
          productName: "Air-Chilled Boneless Skinless Chicken Breasts",
          originBrandName: "No-Antibiotics-Ever",
          regularPrice: "$5.99 to $6.99/lb",
          salePrice: "$5.99/lb",
          primePrice: "15% off",
          endDate: "2026-09-22T05:00:00Z",
        },
        {
          productName: "Organic Yellow Peaches",
          regularPrice: "$3.88/lb",
          primePrice: "$3.49/lb with Prime",
          endDate: "2026-09-22T05:00:00Z",
        },
        {
          productName: "Select Seventh Generation Products",
          salePrice: "22% off",
          primePrice: "30% off",
        },
      ],
    });

    expect(offers.some((offer) => /peach/i.test(offer.productName))).toBe(true);
    expect(offers.find((offer) => /peach/i.test(offer.productName))?.price).toBe(
      3.49,
    );
    expect(offers.some((offer) => /chicken/i.test(offer.productName))).toBe(true);
    expect(offers.some((offer) => /Seventh Generation/i.test(offer.productName))).toBe(
      false,
    );
  });
});

describe("parseWholeFoodsOfferPrice", () => {
  it("parses dollars, per-pound, and multi-buy unit estimates", () => {
    expect(parseWholeFoodsOfferPrice("$3.88/lb")?.price).toBe(3.88);
    expect(parseWholeFoodsOfferPrice("4 for $5")?.price).toBe(1.25);
    expect(parseWholeFoodsOfferPrice("22% off")).toBeNull();
    expect(parseWholeFoodsOfferPrice("BOGO 25% off")).toBeNull();
  });
});
