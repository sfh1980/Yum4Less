import { describe, expect, it } from "vitest";
import {
  buildInactiveRecipeSourceShopperNotice,
  buildRecipeSourceResearchSummary,
  getDefaultRecipeSource,
  isRecipeSourceActive,
  listSelectableRecipeSources,
} from "@/lib/recipe-sources/recipe-source-registry";

describe("recipe source registry", () => {
  it("keeps internal library and TheMealDB as active MVP sources", () => {
    expect(getDefaultRecipeSource()).toBe("internal-library");
    expect(isRecipeSourceActive("internal-library")).toBe(true);
    expect(isRecipeSourceActive("themealdb")).toBe(true);
    expect(isRecipeSourceActive("spoonacular")).toBe(false);
    expect(isRecipeSourceActive("edamam")).toBe(false);
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
      "primary",
    );
    expect(sources.find((source) => source.id === "internal-library")?.summary).not.toContain(
      "in-memory",
    );
  });

  it("summarizes active and blocked recipe sources", () => {
    expect(buildRecipeSourceResearchSummary()).toContain("TheMealDB");
    expect(buildRecipeSourceResearchSummary()).not.toContain(
      "ranks from the internal library and sale-matched",
    );
  });

  it("builds layman shopper copy for inactive recipe sources", () => {
    const notice = buildInactiveRecipeSourceShopperNotice("spoonacular");

    expect(notice.title).toContain("Spoonacular");
    expect(notice.body).toContain("TheMealDB");
    expect(notice.body).not.toContain("MVP");
  });
});
