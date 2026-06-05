import { describe, expect, it } from "vitest";
import {
  inferIngredientCategory,
  normalizeAliasLabel,
  slugifyIngredientId,
} from "@/lib/recipe-import/ingredient-normalization";
import { shouldRejectThemealdbIngredientLabel } from "@/lib/recipe-import/themealdb-reject-patterns";

describe("ingredient normalization helpers", () => {
  it("normalizes alias labels for lookup", () => {
    expect(normalizeAliasLabel("  Chicken  Breast ")).toBe("chicken breast");
  });

  it("slugifies external labels into catalog ids", () => {
    expect(slugifyIngredientId("Red Bell Pepper")).toBe("red-bell-pepper");
  });

  it("rejects garnish and beverage labels", () => {
    expect(shouldRejectThemealdbIngredientLabel("water")).toBe(true);
    expect(shouldRejectThemealdbIngredientLabel("parsley to garnish")).toBe(true);
    expect(shouldRejectThemealdbIngredientLabel("chicken breast")).toBe(false);
  });

  it("infers grocery categories for expandable ingredients", () => {
    expect(inferIngredientCategory("chicken breast")).toBe("protein");
    expect(inferIngredientCategory("red onion")).toBe("produce");
    expect(inferIngredientCategory("olive oil")).toBe("pantry");
    expect(inferIngredientCategory("x")).toBe(null);
  });
});
