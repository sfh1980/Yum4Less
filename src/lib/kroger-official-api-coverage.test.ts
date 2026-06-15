import { describe, expect, it } from "vitest";
import {
  buildKrogerOfficialApiStoreCoverage,
  krogerOfficialApiPromotionGatesPass,
} from "@/lib/kroger-official-api-coverage";

describe("buildKrogerOfficialApiStoreCoverage", () => {
  it("counts distinct fresh kroger-official-api ingredients within 24 hours", () => {
    const coverage = buildKrogerOfficialApiStoreCoverage({
      storeId: "kroger-mechanicsville",
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 6.49,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 2,
          inStock: true,
          priceSource: "kroger-official-api",
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "broccoli",
          price: 2.49,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 4,
          inStock: true,
          priceSource: "kroger-official-api",
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "lemon",
          price: 0.85,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 6,
          inStock: true,
          priceSource: "kroger-official-api",
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "olive-oil",
          price: 7.49,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 30,
          inStock: true,
          priceSource: "kroger-official-api",
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "baby-potatoes",
          price: 2.99,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 1,
          inStock: true,
          priceSource: "kroger-weekly-ad-scrape",
        },
      ],
    });

    expect(coverage.freshMatchedIngredientCount).toBe(3);
    expect(coverage.usesOfficialApiSource).toBe(true);
    expect(krogerOfficialApiPromotionGatesPass(coverage)).toBe(true);
  });

  it("does not count stale official-api rows toward the gate", () => {
    const coverage = buildKrogerOfficialApiStoreCoverage({
      storeId: "kroger-mechanicsville",
      priceObservations: [
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          price: 6.49,
          freshnessDaysAgo: 2,
          freshnessHoursAgo: 48,
          inStock: true,
          priceSource: "kroger-official-api",
        },
        {
          storeId: "kroger-mechanicsville",
          ingredientId: "broccoli",
          price: 2.49,
          freshnessDaysAgo: 0,
          freshnessHoursAgo: 2,
          inStock: true,
          priceSource: "kroger-official-api",
        },
      ],
    });

    expect(coverage.freshMatchedIngredientCount).toBe(1);
    expect(krogerOfficialApiPromotionGatesPass(coverage)).toBe(false);
  });
});
