import { describe, expect, it } from "vitest";
import {
  parseThemealdbIngredientLines,
  parseThemealdbInstructions,
  parseThemealdbTags,
  slugifyThemealdbRecipeId,
  ThemealdbClient,
} from "@/lib/recipe-import/themealdb-client";
import type { ThemealdbLookupMeal } from "@/lib/recipe-import/themealdb-types";

describe("ThemealdbClient", () => {
  it("caches filter responses within one import run", async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return new Response(JSON.stringify({ meals: [{ idMeal: "1", strMeal: "Test", strMealThumb: "" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const client = new ThemealdbClient({ apiKey: "1", fetchFn, rateLimitMs: 0 });
    await client.filterByIngredient("chicken");
    await client.filterByIngredient("chicken");

    expect(calls).toBe(1);
  });

  it("defaults to test key 1 when env is unset", async () => {
    const capturedUrls: string[] = [];
    const fetchFn = async (url: string) => {
      capturedUrls.push(url);
      return new Response(JSON.stringify({ meals: null }), { status: 200 });
    };

    const client = new ThemealdbClient({ fetchFn, rateLimitMs: 0 });
    await client.filterByIngredient("garlic");

    expect(capturedUrls[0]).toContain("/1/filter.php?i=garlic");
  });
});

describe("Themealdb parsing helpers", () => {
  it("parses ingredient lines and skips empty slots", () => {
    const meal = {
      idMeal: "52772",
      strMeal: "Teriyaki Chicken Casserole",
      strIngredient1: "soy sauce",
      strMeasure1: "3/4 cup",
      strIngredient2: "water",
      strMeasure2: "",
      strIngredient3: "  ",
      strMeasure3: "1 tsp",
    } as ThemealdbLookupMeal;

    expect(parseThemealdbIngredientLines(meal)).toEqual([
      { displayName: "soy sauce", measure: "3/4 cup" },
      { displayName: "water", measure: "" },
    ]);
  });

  it("parses instructions into non-empty steps", () => {
    const meal = {
      idMeal: "1",
      strMeal: "Test",
      strInstructions: "Step one\n\nStep two\r\n",
    } as ThemealdbLookupMeal;

    expect(parseThemealdbInstructions(meal)).toEqual(["Step one", "Step two"]);
  });

  it("parses comma-separated tags", () => {
    const meal = {
      idMeal: "1",
      strMeal: "Test",
      strTags: "Pasta,Meat,Casserole",
    } as ThemealdbLookupMeal;

    expect(parseThemealdbTags(meal)).toEqual(["Pasta", "Meat", "Casserole"]);
  });

  it("builds stable recipe ids from idMeal and title", () => {
    expect(slugifyThemealdbRecipeId("52772", "Teriyaki Chicken Casserole")).toBe(
      "themealdb-52772-teriyaki-chicken-casserole",
    );
  });
});
