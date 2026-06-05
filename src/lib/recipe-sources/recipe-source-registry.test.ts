import { describe, expect, it } from "vitest";
import {
  buildInactiveRecipeSourceShopperNotice,
  buildRecipeSourceResearchSummary,
  getDefaultRecipeSource,
  isRecipeSourceActive,
  listSelectableRecipeSources,
} from "@/lib/recipe-sources/recipe-source-registry";

describe("recipe source registry", () => {
  it("keeps internal library as the only active MVP source", () => {
    expect(getDefaultRecipeSource()).toBe("internal-library");
    expect(isRecipeSourceActive("internal-library")).toBe(true);
    expect(isRecipeSourceActive("spoonacular")).toBe(false);
    expect(isRecipeSourceActive("edamam")).toBe(false);
    expect(isRecipeSourceActive("themealdb")).toBe(false);
  });

  it("documents external providers with terms and trust notes", () => {
    const sources = listSelectableRecipeSources();

    expect(sources.find((source) => source.id === "spoonacular")?.termsUrl).toContain(
      "spoonacular.com",
    );
    expect(sources.find((source) => source.id === "edamam")?.mvpRecommendation).toBe(
      "not-approved",
    );
    expect(sources.find((source) => source.id === "themealdb")?.mvpRecommendation).toBe(
      "dev-only",
    );
    expect(sources.find((source) => source.id === "internal-library")?.summary).not.toContain(
      "in-memory",
    );
  });

  it("summarizes that external sources remain research-only", () => {
    expect(buildRecipeSourceResearchSummary()).toContain("internal library only");
  });

  it("builds layman shopper copy for inactive recipe sources", () => {
    const notice = buildInactiveRecipeSourceShopperNotice("spoonacular");

    expect(notice.title).toContain("Spoonacular");
    expect(notice.body).toContain("internal recipe library");
    expect(notice.body).not.toContain("MVP");
  });
});
