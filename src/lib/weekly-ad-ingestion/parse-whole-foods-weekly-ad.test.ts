import { describe, expect, it } from "vitest";
import {
  formatWholeFoodsFlyerDateLog,
  parseWholeFoodsOfferPrice,
  parseWholeFoodsWeeklyAd,
  summarizeWholeFoodsFlyerDates,
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
    expect(offers.find((offer) => /chicken/i.test(offer.productName))?.validThrough).toBe(
      "2026-09-22T05:00:00Z",
    );
  });

  it("stores an end date and leaves valid_through empty when only a start date exists", () => {
    const withEnd = parseWholeFoodsWeeklyAd({
      promotions: [
        {
          productName: "Organic Hass Avocados",
          salePrice: "4 for $5",
          startDate: "2026-10-21T04:00:00Z",
          endDate: "2026-10-28T04:00:00Z",
        },
      ],
    });
    expect(withEnd[0]?.validThrough).toBe("2026-10-28T04:00:00Z");

    const startOnly = parseWholeFoodsWeeklyAd({
      promotions: [
        {
          productName: "Organic Hass Avocados",
          salePrice: "4 for $5",
          startDate: "2026-10-21T04:00:00Z",
        },
      ],
    });
    expect(startOnly[0]?.validThrough).toBeUndefined();
  });

  it("summarizes flyer start and end dates without treating the start as the end", () => {
    const dates = summarizeWholeFoodsFlyerDates([
      {
        productName: "Organic Hass Avocados",
        startDate: "2026-10-21T04:00:00Z",
        endDate: "2026-10-28T04:00:00Z",
      },
      {
        productName: "Bananas",
        startDate: "2026-10-21T04:00:00Z",
      },
    ]);
    expect(dates.startDates).toEqual(["2026-10-21T04:00:00Z"]);
    expect(dates.endDates).toEqual(["2026-10-28T04:00:00Z"]);
    expect(
      formatWholeFoodsFlyerDateLog({
        storeId: "10257",
        startDates: dates.startDates,
        endDates: dates.endDates,
      }),
    ).toBe(
      "[whole-foods] parsed flyer dates for store 10257 start=2026-10-21T04:00:00Z end=2026-10-28T04:00:00Z",
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
