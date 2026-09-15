import { describe, expect, it } from "vitest";
import {
  parseTargetOfferPrice,
  parseTargetWeeklyAd,
} from "@/lib/weekly-ad-ingestion/parse-target-weekly-ad";

describe("parseTargetWeeklyAd", () => {
  it("extracts unit-priced hotspots and skips BOGO-only lines", () => {
    const offers = parseTargetWeeklyAd({
      promotionDetails: [
        {
          sale_end_date: "09/19/2026 11:59:00 PM",
          pages: [
            {
              hotspots: [
                {
                  title: "Good & Gather cottage cheese",
                  price: "2.99",
                },
                {
                  title: "Chobani Greek yogurt",
                  price: "7/$7",
                },
                {
                  title: "Select Barebells protein bars",
                  price: "BOGO 25% off",
                },
                {
                  title: "Frozen meals",
                  price: "3/$9",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productName: "Good & Gather cottage cheese",
          price: 2.99,
        }),
        expect.objectContaining({
          productName: "Chobani Greek yogurt",
          price: 1,
        }),
        expect.objectContaining({
          productName: "Frozen meals",
          price: 3,
        }),
      ]),
    );
    expect(offers.some((offer) => /Barebells/i.test(offer.productName))).toBe(
      false,
    );
  });
});

describe("parseTargetOfferPrice", () => {
  it("parses bare dollars and multi-buy unit estimates", () => {
    expect(parseTargetOfferPrice("2.99")).toEqual({
      price: 2.99,
      saleLabel: "Directional — Target weekly ad",
    });
    expect(parseTargetOfferPrice("3/$9")?.price).toBe(3);
    expect(parseTargetOfferPrice("BOGO 25% off")).toBeNull();
  });
});
