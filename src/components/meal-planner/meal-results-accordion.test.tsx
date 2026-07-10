// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MealResultsAccordion } from "@/components/meal-planner/meal-results-accordion";
import type { MealRecommendation } from "@/lib/recommendation-service";
import type { FormState } from "@/components/meal-planner/types";

vi.mock("@/components/meal-planner/meal-recommendation-card", () => ({
  MealRecommendationCard: ({ meal, hideTitle }: { meal: MealRecommendation; hideTitle?: boolean }) =>
    createElement(
      "article",
      { "data-testid": "meal-card", "data-hide-title": hideTitle ? "true" : "false" },
      meal.title,
    ),
}));

const form: FormState = {
  zipCode: "23111",
  radiusMiles: "5",
  budget: "25",
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  theme: "system" as const,
  selectedStoreIds: ["kroger-mechanicsville"],
};

const market = {
  searchedZipCode: "23111",
  locationLabel: "Mechanicsville, VA",
  searchLatitude: 37.6085,
  searchLongitude: -77.3321,
  radiusMiles: 5,
  nearbyStores: [],
  recommendationReadyStoreCount: 1,
  providerRollout: [],
  providerStoreSearches: [],
  providerPricingPreviews: [],
  providerCoverageRollup: {
    overallCoverageStatus: "limited" as const,
    trustGate: "monitoring" as const,
    rankedPricingSource: "weekly-ad-cache" as const,
    totalTrackedIngredients: 1,
    matchedIngredientCount: 1,
    unmatchedIngredientCount: 0,
    averageMatchConfidence: 0.8,
    usesCachedPreview: false,
    ingredientSummaries: [],
    message: "Fixture coverage.",
  },
  providerPromotionReadiness: [],
  providerPriceObservationSync: [],
  weeklyAdIngestionStatus: [],
  weeklyAdPromotionReadiness: [],
  lookupSource: "seed" as const,
  lookupProviderConfigured: false,
  dataSource: "database" as const,
  saleIngredientChoices: [],
  message: "Fixture market.",
};

function buildMeal(title: string): MealRecommendation {
  return {
    title,
    summary: "Fixture summary.",
    estimatedTotal: 12,
    storeCount: 1,
    matchedIngredients: 2,
    cookTimeMinutes: 30,
    difficulty: "easy",
    primaryStore: "Kroger",
    ingredientHighlights: ["chicken"],
    instructions: ["Cook."],
    shoppingPlan: [],
    storePlan: [],
    score: { total: 70, price: 30, convenience: 20, freshness: 10, fit: 10 },
    confidenceLabel: "Single-store estimate",
    tags: [],
    freshnessLabel: "Recent weekly-ad prices",
    explanation: "Fixture.",
    providerPreviewComparisons: [],
  };
}

describe("MealResultsAccordion", () => {
  const onOpenStoreMap = vi.fn();

  it("starts collapsed with title-only triggers", () => {
    render(
      createElement(MealResultsAccordion, {
        ariaLabel: "Suggested dinner recipes",
        recommendations: [buildMeal("First dinner"), buildMeal("Second dinner")],
        form,
        market,
        onOpenStoreMap,
      }),
    );

    expect(screen.getByRole("button", { name: "First dinner" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Second dinner" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByTestId("meal-card")).not.toBeInTheDocument();
  });

  it("expands one card at a time and collapses the previous card", async () => {
    render(
      createElement(MealResultsAccordion, {
        ariaLabel: "Suggested dinner recipes",
        recommendations: [buildMeal("First dinner"), buildMeal("Second dinner")],
        form,
        market,
        onOpenStoreMap,
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "First dinner" }));

    expect(screen.getByRole("button", { name: "First dinner" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("meal-card")).toHaveTextContent("First dinner");
    expect(screen.getByTestId("meal-card")).toHaveAttribute("data-hide-title", "true");

    await userEvent.click(screen.getByRole("button", { name: "Second dinner" }));

    expect(screen.getByRole("button", { name: "First dinner" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Second dinner" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("meal-card")).toHaveTextContent("Second dinner");
  });

  it("collapses the expanded card when its trigger is clicked again", async () => {
    render(
      createElement(MealResultsAccordion, {
        ariaLabel: "Suggested dinner recipes",
        recommendations: [buildMeal("First dinner")],
        form,
        market,
        onOpenStoreMap,
      }),
    );

    const trigger = screen.getByRole("button", { name: "First dinner" });
    await userEvent.click(trigger);
    expect(screen.getByTestId("meal-card")).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("meal-card")).not.toBeInTheDocument();
  });
});
