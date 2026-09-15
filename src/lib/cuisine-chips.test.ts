import { describe, expect, it } from "vitest";
import {
  countCuisineFacets,
  cuisineChipFromSummary,
  mapThemealdbAreaToCuisineChip,
  parseSelectedCuisineIds,
  recipeMatchesSelectedCuisines,
  visibleCuisineChips,
} from "@/lib/cuisine-chips";

describe("cuisine chips (R11)", () => {
  it("maps TheMealDB areas into the curated chip set", () => {
    expect(mapThemealdbAreaToCuisineChip("Italian")).toBe("italian");
    expect(mapThemealdbAreaToCuisineChip("United States")).toBe("american");
    expect(mapThemealdbAreaToCuisineChip("British")).toBe("american");
    expect(mapThemealdbAreaToCuisineChip("South Korean")).toBe("korean");
    expect(mapThemealdbAreaToCuisineChip("French")).toBeNull();
  });

  it("parses cuisine from summary prose for backfill", () => {
    expect(cuisineChipFromSummary("Category: Beef. Cuisine: Mexican. Sale overlap: 3.")).toBe(
      "mexican",
    );
    expect(cuisineChipFromSummary("No cuisine here.")).toBeNull();
  });

  it("hides chips below the min dinner threshold", () => {
    expect(
      visibleCuisineChips({ italian: 5, mexican: 1, chinese: 2 }, 2),
    ).toEqual(["italian", "chinese"]);
  });

  it("counts facets and filters selected cuisines", () => {
    const recipes = [
      { cuisineTags: ["italian" as const] },
      { cuisineTags: ["italian" as const, "american" as const] },
      { cuisineTags: ["mexican" as const] },
    ];
    expect(countCuisineFacets(recipes)).toEqual({
      italian: 2,
      american: 1,
      mexican: 1,
    });
    expect(recipeMatchesSelectedCuisines(recipes[0]!, [])).toBe(true);
    expect(recipeMatchesSelectedCuisines(recipes[0]!, ["mexican"])).toBe(false);
    expect(recipeMatchesSelectedCuisines(recipes[0]!, ["italian"])).toBe(true);
  });

  it("parses selectedCuisineIds allowlist", () => {
    expect(parseSelectedCuisineIds(["italian", "mexican"])).toEqual([
      "italian",
      "mexican",
    ]);
    expect(parseSelectedCuisineIds(["italian", "french"])).toBeUndefined();
    expect(parseSelectedCuisineIds(undefined)).toEqual([]);
  });
});
