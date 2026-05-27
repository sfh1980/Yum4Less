import { describe, expect, it } from "vitest";
import { mockPriceObservations } from "@/lib/mock-market-data";
import {
  buildWeeklyAdStoreCoverage,
  MIN_WEEKLY_AD_PROMOTION_MATCHES,
  weeklyAdPromotionGatesPass,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";

describe("weekly ad coverage", () => {
  const recipeIngredientIds = [
    "chicken-thighs",
    "broccoli",
    "baby-potatoes",
    "olive-oil",
    "black-beans",
    "lemon",
  ];

  it("counts weekly-ad observations for a store", () => {
    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: [
        ...mockPriceObservations,
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 5.79,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.82,
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "broccoli",
          price: 1.99,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.76,
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "black-beans",
          price: 0.99,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.71,
        },
      ],
      recipeIngredientIds,
    });

    expect(coverage.matchedIngredientCount).toBe(3);
    expect(coverage.usesWeeklyAdSource).toBe(true);
    expect(coverage.coverageStatus).toBe("limited");
    expect(weeklyAdPromotionGatesPass(coverage, "kroger")).toBe(true);
  });

  it("does not promote when matches are below the minimum threshold", () => {
    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 5.79,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.82,
        },
      ],
      recipeIngredientIds,
    });

    expect(coverage.matchedIngredientCount).toBeLessThan(
      MIN_WEEKLY_AD_PROMOTION_MATCHES,
    );
    expect(weeklyAdPromotionGatesPass(coverage, "kroger")).toBe(false);
  });

  it("does not promote stale weekly-ad observations", () => {
    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 5.79,
          freshnessDaysAgo: 20,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.82,
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "broccoli",
          price: 1.99,
          freshnessDaysAgo: 20,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.76,
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "black-beans",
          price: 0.99,
          freshnessDaysAgo: 20,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.71,
        },
      ],
      recipeIngredientIds,
    });

    expect(weeklyAdPromotionGatesPass(coverage, "kroger")).toBe(false);
  });

  it("never promotes Walmart even with strong weekly-ad coverage", () => {
    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "walmart-rocketts",
      chain: "walmart",
      priceObservations: [
        {
          storeId: "walmart-rocketts",
          ingredientId: "chicken-thighs",
          price: 2.99,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "walmart-weekly-ad-scrape",
          matchConfidence: 0.9,
        },
        {
          storeId: "walmart-rocketts",
          ingredientId: "broccoli",
          price: 1.99,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "walmart-weekly-ad-scrape",
          matchConfidence: 0.9,
        },
        {
          storeId: "walmart-rocketts",
          ingredientId: "black-beans",
          price: 0.99,
          freshnessDaysAgo: 0,
          inStock: true,
          priceSource: "walmart-weekly-ad-scrape",
          matchConfidence: 0.9,
        },
      ],
      recipeIngredientIds,
    });

    expect(coverage.matchedIngredientCount).toBeGreaterThanOrEqual(
      MIN_WEEKLY_AD_PROMOTION_MATCHES,
    );
    expect(weeklyAdPromotionGatesPass(coverage, "walmart")).toBe(false);
  });
});
