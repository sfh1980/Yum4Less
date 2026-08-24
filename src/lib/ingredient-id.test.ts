import { describe, expect, it } from "vitest";
import {
  CANONICAL_INGREDIENT_ID_MAX,
  isCanonicalIngredientId,
  slugifyIngredientId,
  titleCaseIngredientName,
} from "@/lib/ingredient-id";

describe("canonical food ids", () => {
  it("slugifies flyer labels into kebab-case ids", () => {
    expect(slugifyIngredientId("Red Bell Pepper")).toBe("red-bell-pepper");
    expect(slugifyIngredientId("Imitation Crab Meat")).toBe("imitation-crab-meat");
    expect(slugifyIngredientId("  Chicken--Thighs!! ")).toBe("chicken-thighs");
  });

  it("caps slug length at the catalog max", () => {
    const long = "a".repeat(CANONICAL_INGREDIENT_ID_MAX + 12);
    expect(slugifyIngredientId(long).length).toBe(CANONICAL_INGREDIENT_ID_MAX);
  });

  it("accepts existing catalog ids and rejects brands or spaces", () => {
    expect(isCanonicalIngredientId("chicken-thighs")).toBe(true);
    expect(isCanonicalIngredientId("imitation-crab")).toBe(true);
    expect(isCanonicalIngredientId("Chicken Thighs")).toBe(false);
    expect(isCanonicalIngredientId("yoplait-strawberry-6oz!")).toBe(false);
    expect(isCanonicalIngredientId("a")).toBe(false);
  });

  it("title-cases shopper-facing names", () => {
    expect(titleCaseIngredientName("imitation crab meat")).toBe("Imitation Crab Meat");
  });
});
