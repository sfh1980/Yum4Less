import { describe, expect, it } from "vitest";
import {
  INTERNAL_CATALOG_INGREDIENTS,
  INTERNAL_CATALOG_INGREDIENT_IDS,
} from "@/lib/internal-catalog";

describe("internal catalog", () => {
  it("tracks 97 dinner ingredients across seven categories", () => {
    expect(INTERNAL_CATALOG_INGREDIENTS).toHaveLength(97);
    expect(new Set(INTERNAL_CATALOG_INGREDIENT_IDS).size).toBe(97);

    const byCategory = INTERNAL_CATALOG_INGREDIENTS.reduce<Record<string, number>>(
      (counts, ingredient) => {
        counts[ingredient.category] = (counts[ingredient.category] ?? 0) + 1;
        return counts;
      },
      {},
    );

    expect(byCategory).toMatchObject({
      protein: 10,
      produce: 21,
      pantry: 24,
      dairy: 11,
      seasoning: 16,
      baking: 8,
      frozen: 7,
    });
  });

  it("includes expanded seasoning, baking, and frozen staples", () => {
    expect(INTERNAL_CATALOG_INGREDIENT_IDS).toEqual(
      expect.arrayContaining([
        "cumin",
        "all-purpose-flour",
        "frozen-broccoli",
        "bacon",
        "white-rice",
      ]),
    );
  });
});
