import { describe, expect, it } from "vitest";
import { selectBestWeeklyAdOffersPerIngredient } from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";
import type { WeeklyAdOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const NOW = new Date("2026-11-10T08:00:00.000Z");

function offer(input: {
  ingredientId: string;
  productName: string;
  price: number;
  validFrom?: string;
}): WeeklyAdOffer {
  return {
    chain: "aldi",
    storeId: "aldi-1",
    ingredientId: input.ingredientId,
    productName: input.productName,
    price: input.price,
    validFrom: input.validFrom,
    sourceUrl: "https://example.test/flyer",
    observedAt: NOW.toISOString(),
    confidenceScore: 0.9,
    matchConfidence: 0.9,
  };
}

describe("selectBestWeeklyAdOffersPerIngredient", () => {
  it("keeps this week's offer and a cheaper next-week offer, and keeps a next-week-only offer", () => {
    const selected = selectBestWeeklyAdOffersPerIngredient(
      [
        offer({
          ingredientId: "milk",
          productName: "Milk this week",
          price: 4,
          validFrom: "2026-11-04T05:00:00Z",
        }),
        offer({
          ingredientId: "milk",
          productName: "Milk next week",
          price: 2,
          validFrom: "2026-11-11T05:00:00Z",
        }),
        offer({
          ingredientId: "bread",
          productName: "Bread next week",
          price: 1.5,
          validFrom: "2026-11-11T05:00:00Z",
        }),
      ],
      NOW,
    );

    const milk = selected.filter((item) => item.ingredientId === "milk");
    expect(milk.map((item) => item.productName)).toEqual([
      "Milk this week",
      "Milk next week",
    ]);
    expect(selected.filter((item) => item.ingredientId === "bread").map((item) => item.productName)).toEqual([
      "Bread next week",
    ]);
  });

  it("does not keep a next-week offer that costs as much or more", () => {
    const selected = selectBestWeeklyAdOffersPerIngredient(
      [
        offer({
          ingredientId: "milk",
          productName: "Milk this week",
          price: 2,
        }),
        offer({
          ingredientId: "milk",
          productName: "Milk next week",
          price: 2,
          validFrom: "2026-11-11T05:00:00Z",
        }),
      ],
      NOW,
    );
    expect(selected.map((item) => item.productName)).toEqual(["Milk this week"]);
  });
});
