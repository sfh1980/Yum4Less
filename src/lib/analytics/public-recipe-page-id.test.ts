import { describe, expect, it } from "vitest";
import { publicRecipePageId } from "@/lib/analytics/public-recipe-page-id";

describe("publicRecipePageId", () => {
  it("keeps the numeric page id from a full recipe URL", () => {
    expect(publicRecipePageId("https://www.themealdb.com/meal/52772")).toBe("52772");
    expect(publicRecipePageId("https://www.themealdb.com/meal/52772/")).toBe("52772");
  });

  it("drops titles, coordinates, and other URLs", () => {
    expect(publicRecipePageId("Chicken soup")).toBeNull();
    expect(publicRecipePageId("https://www.themealdb.com/meal/52772?lat=37.6")).toBeNull();
    expect(publicRecipePageId("https://example.com/meal/52772")).toBeNull();
    expect(publicRecipePageId(undefined)).toBeNull();
  });
});
