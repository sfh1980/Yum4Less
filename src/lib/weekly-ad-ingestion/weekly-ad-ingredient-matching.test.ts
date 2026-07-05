import { describe, expect, it } from "vitest";
import {
  matchWeeklyAdOffers,
  MIN_WEEKLY_AD_MATCH_CONFIDENCE,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";

describe("weekly ad ingredient matching", () => {
  it("matches Walmart-style Flipp titles using grocery aliases", () => {
    const offers = matchWeeklyAdOffers({
      chain: "walmart",
      storeId: "walmart-rocketts",
      sourceUrl: "https://www.walmart.com/store/weekly-ads",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [
        { productName: "Great Value Black Beans 15 oz", price: 0.92 },
        { productName: "Fresh Green Cabbage Head", price: 1.78 },
        { productName: "Mission Corn Tortillas 30 ct", price: 1.88 },
        { productName: "Blackstone Original Outdoor Griddle, Black", price: 99 },
      ],
      trackedIngredientIds: ["black-beans", "cabbage", "corn-tortillas"],
    });

    const matched = offers.filter((offer) => offer.ingredientId);
    expect(matched).toHaveLength(3);
    expect(
      matched.every(
        (offer) => (offer.matchConfidence ?? 0) >= MIN_WEEKLY_AD_MATCH_CONFIDENCE,
      ),
    ).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "black-beans")).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "cabbage")).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "corn-tortillas")).toBe(true);
    expect(matched.some((offer) => offer.productName.includes("Griddle"))).toBe(false);
  });

  it("matches short weekly-ad titles that include a thigh cue", () => {
    const offers = matchWeeklyAdOffers({
      chain: "walmart",
      storeId: "walmart-rocketts",
      sourceUrl: "https://www.walmart.com/store/weekly-ads",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [{ productName: "Fresh Chicken Thighs Family Pack", price: 6.99 }],
      trackedIngredientIds: ["chicken-thighs"],
    });

    expect(offers[0]?.ingredientId).toBe("chicken-thighs");
    expect(offers[0]?.matchConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
  });

  it("matches ground beef and chicken breast titles from Kroger-style ads", () => {
    const offers = matchWeeklyAdOffers({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      sourceUrl: "https://www.kroger.com/weeklyad",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [
        { productName: "Kroger 80% Lean Ground Beef, 3 lb", price: 17.97 },
        {
          productName: "Simple Truth Natural Boneless Chicken Breasts, Value Pack",
          price: 3.99,
        },
        { productName: "Classico Pasta Sauce, 24 oz", price: 3.19 },
      ],
      trackedIngredientIds: ["ground-beef", "chicken-breast", "pasta-sauce"],
    });

    const matched = offers.filter((offer) => offer.ingredientId);
    expect(matched).toHaveLength(3);
    expect(matched.some((offer) => offer.ingredientId === "ground-beef")).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "chicken-breast")).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "pasta-sauce")).toBe(true);
  });

  it("does not match chicken breast ads to chicken thighs", () => {
    const offers = matchWeeklyAdOffers({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      sourceUrl: "https://www.kroger.com/weeklyad",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [
        {
          productName: "Simple Truth Natural Boneless Chicken Breasts, Value Pack",
          price: 3.99,
        },
      ],
      trackedIngredientIds: ["chicken-thighs"],
    });

    expect(offers[0]?.ingredientId).toBeUndefined();
  });

  it("does not match potato chips to baby potatoes", () => {
    const offers = matchWeeklyAdOffers({
      chain: "walmart",
      storeId: "walmart-rocketts",
      sourceUrl: "https://www.walmart.com/store/weekly-ads",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [{ productName: "Lay's Classic Potato Chips", price: 2.5 }],
      trackedIngredientIds: ["baby-potatoes"],
    });

    expect(offers[0]?.ingredientId).toBeUndefined();
  });

  it("matches chicken broth and italian sausage titles from weekly ads", () => {
    const offers = matchWeeklyAdOffers({
      chain: "kroger",
      storeId: "kroger-mechanicsville",
      sourceUrl: "https://www.kroger.com/weeklyad",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [
        { productName: "Swanson Chicken Broth 32 oz", price: 2.49 },
        { productName: "Johnsonville Mild Italian Sausage Links, 19 oz", price: 4.99 },
        { productName: "Kraft Shredded Mozzarella Cheese 8 oz", price: 2.79 },
      ],
      trackedIngredientIds: ["chicken-broth", "italian-sausage", "mozzarella"],
    });

    const matched = offers.filter((offer) => offer.ingredientId);
    expect(matched).toHaveLength(3);
    expect(matched.some((offer) => offer.ingredientId === "chicken-broth")).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "italian-sausage")).toBe(true);
    expect(matched.some((offer) => offer.ingredientId === "mozzarella")).toBe(true);
  });

  it("matches Flipp-style greek yogurt titles to plain-yogurt at or above threshold", () => {
    for (const productName of ["Chobani Greek Yogurt", "Fage Greek Yogurt"]) {
      const offers = matchWeeklyAdOffers({
        chain: "kroger",
        storeId: "kroger-mechanicsville",
        sourceUrl: "https://www.kroger.com/weeklyad",
        observedAt: "2026-06-28T00:00:00.000Z",
        rawOffers: [{ productName, price: 1.25 }],
        trackedIngredientIds: ["plain-yogurt"],
      });

      expect(offers[0]?.ingredientId).toBe("plain-yogurt");
      expect(offers[0]?.matchConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    }
  });

  it("does not match tortilla chips to flour tortillas", () => {
    const offers = matchWeeklyAdOffers({
      chain: "walmart",
      storeId: "walmart-rocketts",
      sourceUrl: "https://www.walmart.com/store/weekly-ads",
      observedAt: "2026-05-26T00:00:00.000Z",
      rawOffers: [{ productName: "Tostitos Original Tortilla Chips 13 oz", price: 3.98 }],
      trackedIngredientIds: ["flour-tortillas"],
    });

    expect(offers[0]?.ingredientId).toBeUndefined();
  });
});
