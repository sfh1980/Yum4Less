import { describe, expect, it } from "vitest";
import { RANKED_PRICE_CACHE_TTL_HOURS } from "@/lib/ranked-price-cache-policy";
import { fixturePriceObservations } from "@/lib/fixtures/market-catalog.fixtures";
import {
  buildWeeklyAdStoreCoverage,
  MIN_WEEKLY_AD_PROMOTION_MATCHES,
  WEEKLY_AD_PROMOTION_FRESHNESS_HOURS,
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

  it("uses the same freshness threshold as ranked price cache reads", () => {
    expect(WEEKLY_AD_PROMOTION_FRESHNESS_HOURS).toBe(RANKED_PRICE_CACHE_TTL_HOURS);
    expect(WEEKLY_AD_PROMOTION_FRESHNESS_HOURS).toBe(24);
  });

  it("counts weekly-ad observations for a store", () => {
    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: [
        ...fixturePriceObservations,
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

  it("does not promote weekly-ad observations older than the ranked cache window", () => {
    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 5.79,
          freshnessHoursAgo: 25,
          freshnessDaysAgo: 1,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.82,
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "broccoli",
          price: 1.99,
          freshnessHoursAgo: 25,
          freshnessDaysAgo: 1,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.76,
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "black-beans",
          price: 0.99,
          freshnessHoursAgo: 25,
          freshnessDaysAgo: 1,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
          matchConfidence: 0.71,
        },
      ],
      recipeIngredientIds,
    });

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

  it("promotes Walmart when weekly-ad coverage meets the same floors as other ranked banners", () => {
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
    expect(weeklyAdPromotionGatesPass(coverage, "walmart")).toBe(true);
  });

  it("promotes Aldi, Food Lion, Lidl, and Walmart for ranked weekly-ad pricing when gates pass", () => {
    const strongCoverage = {
      storeId: "aldi-mechanicsville",
      chain: "aldi" as const,
      matchedIngredientCount: 5,
      totalRecipeIngredientCount: 6,
      averageMatchConfidence: 0.88,
      maxFreshnessHoursAgo: 0,
      maxFreshnessDaysAgo: 0,
      coverageStatus: "strong" as const,
      usesWeeklyAdSource: true,
    };

    expect(weeklyAdPromotionGatesPass(strongCoverage, "aldi")).toBe(true);
    expect(
      weeklyAdPromotionGatesPass(
        { ...strongCoverage, storeId: "food-lion-mechanicsville", chain: "food-lion" },
        "food-lion",
      ),
    ).toBe(true);
    expect(
      weeklyAdPromotionGatesPass(
        { ...strongCoverage, storeId: "lidl-laburnum", chain: "lidl" },
        "lidl",
      ),
    ).toBe(true);
    expect(
      weeklyAdPromotionGatesPass(
        { ...strongCoverage, storeId: "walmart-rocketts", chain: "walmart" },
        "walmart",
      ),
    ).toBe(true);
  });
});
