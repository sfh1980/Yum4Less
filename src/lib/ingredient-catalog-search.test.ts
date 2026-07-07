import { describe, expect, it } from "vitest";
import { filterIngredientCatalog } from "@/lib/ingredient-catalog-search";

const catalog = [
  { id: "olive-oil", name: "Olive oil", category: "pantry" as const },
  { id: "lime", name: "Lime", category: "produce" as const },
  { id: "black-beans", name: "Black beans", category: "pantry" as const },
];

describe("filterIngredientCatalog", () => {
  it("returns empty results for blank queries", () => {
    expect(filterIngredientCatalog(catalog, "   ")).toEqual([]);
  });

  it("matches ingredient names case-insensitively", () => {
    expect(filterIngredientCatalog(catalog, "oil").map((item) => item.id)).toEqual([
      "olive-oil",
    ]);
  });

  it("prefers prefix matches before substring matches", () => {
    expect(filterIngredientCatalog(catalog, "li").map((item) => item.id)).toEqual([
      "lime",
      "olive-oil",
    ]);
  });
});
