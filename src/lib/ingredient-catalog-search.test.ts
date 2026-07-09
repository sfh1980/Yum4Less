import { describe, expect, it } from "vitest";
import {
  filterIngredientCatalog,
  resolveIngredientFromCatalogQuery,
} from "@/lib/ingredient-catalog-search";

const catalog = [
  { id: "olive-oil", name: "Olive oil", category: "pantry" as const },
  { id: "lime", name: "Lime", category: "produce" as const },
  { id: "black-beans", name: "Black beans", category: "pantry" as const },
  { id: "chicken-breast", name: "Chicken breast", category: "protein" as const },
  { id: "chicken-thighs", name: "Chicken thighs", category: "protein" as const },
  { id: "sugar", name: "Sugar", category: "baking" as const },
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

  it("matches fuzzy partial queries like chix to chicken items", () => {
    expect(filterIngredientCatalog(catalog, "chix").map((item) => item.id)).toEqual([
      "chicken-breast",
      "chicken-thighs",
    ]);
  });
});

describe("resolveIngredientFromCatalogQuery", () => {
  it("resolves exact catalog names to a single match", () => {
    expect(resolveIngredientFromCatalogQuery(catalog, "Sugar")).toEqual({
      kind: "match",
      ingredient: catalog[5],
    });
  });

  it("returns suggestions instead of silently accepting unknown input", () => {
    const result = resolveIngredientFromCatalogQuery(catalog, "chix");
    expect(result.kind).toBe("suggestions");
    if (result.kind === "suggestions") {
      expect(result.suggestions.length).toBeGreaterThan(0);
    }
  });

  it("returns none for garbage input with no close matches", () => {
    expect(resolveIngredientFromCatalogQuery(catalog, "zzzz-not-food")).toEqual({
      kind: "none",
    });
  });
});
