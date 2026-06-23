// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import type { MealRecommendation } from "@/lib/recommendation-service";
import type {
  FormState,
  MarketSearchState,
  RecommendationState,
} from "@/components/meal-planner/types";

vi.mock("@/components/meal-planner/meal-recommendation-card", () => ({
  MealRecommendationCard: ({ meal }: { meal: MealRecommendation }) =>
    createElement("article", { "data-testid": "meal-card" }, meal.title),
}));

const form: FormState = {
  zipCode: "23111",
  radiusMiles: "5",
  budget: "25",
  maxIngredients: "12",
  dinnersWanted: "3",
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  planningMode: "ingredient-first",
  externalRecipeOptIn: false,
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
  lookupSource: "seed-zip" as const,
  lookupProviderConfigured: false,
  dataSource: "database" as const,
  saleIngredientChoices: [],
  message: "Fixture market.",
};

const recommendation: MealRecommendation = {
  title: "Weeknight Lemon Chicken",
  summary: "Simple roasted chicken.",
  estimatedTotal: 13.42,
  storeCount: 1,
  matchedIngredients: 3,
  cookTimeMinutes: 35,
  difficulty: "easy",
  primaryStore: "Kroger Mechanicsville",
  ingredientHighlights: ["chicken thighs"],
  instructions: ["Roast until done."],
  shoppingPlan: [],
  storePlan: [],
  score: { total: 74, price: 32, convenience: 22, freshness: 12, fit: 8 },
  confidenceLabel: "Single-store estimate",
  tags: [],
  freshnessLabel: "Recent weekly-ad prices",
  explanation: "Fits the budget.",
  providerPreviewComparisons: [],
};

describe("MealResultsPanel shopperNotice + recommendations (C1)", () => {
  it("renders both the notice and recipe cards when recommendations are non-empty", () => {
    const marketSearchState: MarketSearchState = { status: "ready", market };
    const recommendationState: RecommendationState = {
      status: "ready",
      recommendations: [recommendation],
      shopperNotice: {
        title: "TheMealDB catalog refresh is scheduled",
        body: "Imported recipes update on the weekly ingest schedule — not during your search.",
      },
    };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [recommendation],
        shopperNotice: recommendationState.shopperNotice,
        marketBlocked: false,
        onOpenTrustExplainer: () => undefined,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "TheMealDB catalog refresh is scheduled",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/weekly ingest schedule/i)).toBeInTheDocument();
    expect(screen.getByTestId("meal-card")).toHaveTextContent(
      "Weeknight Lemon Chicken",
    );
    expect(
      screen.queryByRole("heading", { name: "No recipes match the current filters" }),
    ).not.toBeInTheDocument();
  });

  it("shows only the notice when recommendations are empty", () => {
    const marketSearchState: MarketSearchState = { status: "ready", market };
    const recommendationState: RecommendationState = {
      status: "ready",
      recommendations: [],
      shopperNotice: {
        title: "Select sale ingredients first",
        body: "Check the items you want to cook with, then suggest recipes.",
      },
    };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [],
        shopperNotice: recommendationState.shopperNotice,
        marketBlocked: false,
        onOpenTrustExplainer: () => undefined,
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Select sale ingredients first" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("meal-card")).not.toBeInTheDocument();
  });

  it("shows an error badge instead of Ready to suggest when ranking fails", () => {
    const marketSearchState: MarketSearchState = { status: "ready", market };
    const recommendationState: RecommendationState = {
      status: "error",
      errorTitle: "Too much store data to rank at once",
      error: "Try a smaller radius.",
    };

    const { container } = render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [],
        marketBlocked: false,
        onOpenTrustExplainer: () => undefined,
      }),
    );

    const badge = container.querySelector(".results-actions .badge");
    expect(badge).toHaveTextContent("Too much store data to rank at once");
    expect(screen.queryByText("Ready to suggest")).not.toBeInTheDocument();
  });

  it("shows ingredient-filter empty copy instead of error when rank returns zero meals (M5)", () => {
    const marketSearchState: MarketSearchState = { status: "ready", market };
    const recommendationState: RecommendationState = {
      status: "ready",
      recommendations: [],
      shopperNotice: {
        title: "No recipe ideas for those ingredients",
        body:
          "Try selecting more sale items, widening your budget or ingredient limit, or switch recipe source.",
      },
    };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [],
        shopperNotice: recommendationState.shopperNotice,
        marketBlocked: false,
        onOpenTrustExplainer: () => undefined,
      }),
    );

    expect(
      screen.getByRole("heading", { name: "No recipe ideas for those ingredients" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 recipe(s) suggested")).toBeInTheDocument();
    expect(screen.queryByText("Check your meal preferences")).not.toBeInTheDocument();
    expect(screen.queryByText("Too much store data to rank at once")).not.toBeInTheDocument();
  });

  it("shows Tier C badge copy when ranked stores are unavailable", () => {
    const blockedMarket = {
      ...market,
      recommendationReadyStoreCount: 0,
      nearbyStores: [
        {
          id: "context-1",
          name: "Context Store",
          kind: "grocery" as const,
          latitude: 37.6,
          longitude: -77.3,
          distanceMiles: 1,
          chain: "other" as const,
          chainLabel: "Other",
          rolloutStatus: "context-only" as const,
          recommendationEnabled: false,
          rolloutNote: "Context only.",
          locationProvenance: "osm-search" as const,
          locationBadge: "OSM",
          locationNote: "Fixture.",
        },
      ],
    };
    const marketSearchState: MarketSearchState = {
      status: "ready",
      market: blockedMarket,
    };
    const recommendationState: RecommendationState = { status: "idle" };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market: blockedMarket,
        recommendations: [],
        marketBlocked: true,
        onOpenTrustExplainer: () => undefined,
      }),
    );

    expect(screen.getByText("No ranked meals in this area")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for store search")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Meal estimates not available for this area yet",
      }),
    ).toBeInTheDocument();
  });
});
