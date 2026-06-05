import { describe, expect, it } from "vitest";
import {
  MIN_MAPPABLE_LINE_RATIO,
  MIN_SALE_INGREDIENT_MATCHES,
} from "@/lib/recipe-import/themealdb-types";

describe("sale-driven import thresholds", () => {
  it("requires at least three sale ingredient matches", () => {
    expect(MIN_SALE_INGREDIENT_MATCHES).toBe(3);
  });

  it("requires at least half of recipe lines to map to catalog", () => {
    expect(MIN_MAPPABLE_LINE_RATIO).toBe(0.5);
  });

  it("computes mappable ratio for import decisions", () => {
    const totalLines = 8;
    const mappedLines = 4;
    expect(mappedLines / totalLines).toBeGreaterThanOrEqual(MIN_MAPPABLE_LINE_RATIO);

    const weakMapped = 3;
    expect(weakMapped / totalLines).toBeLessThan(MIN_MAPPABLE_LINE_RATIO);
  });
});

describe("sale overlap intersection logic", () => {
  it("counts meals that appear across multiple sale-ingredient filter results", () => {
    const saleHits = new Map<string, number>();

    for (const mealId of ["52772", "52804", "52772"]) {
      saleHits.set(mealId, (saleHits.get(mealId) ?? 0) + 1);
    }

    for (const mealId of ["52772", "52959"]) {
      saleHits.set(mealId, (saleHits.get(mealId) ?? 0) + 1);
    }

    expect(saleHits.get("52772")).toBe(3);
    expect(
      [...saleHits.entries()].filter(([, count]) => count >= MIN_SALE_INGREDIENT_MATCHES),
    ).toHaveLength(1);
  });
});
