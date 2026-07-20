// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MealResultsPanel } from "@/components/meal-planner/meal-results-panel";
import { buildTestMarket } from "@/components/meal-planner/test-fixtures";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";
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
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  theme: "system" as const,
  selectedStoreIds: ["kroger-mechanicsville"],
};

const market = buildTestMarket();

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
  it("renders both the notice and recipe cards when recommendations are non-empty", async () => {
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
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "TheMealDB catalog refresh is scheduled",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/weekly ingest schedule/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Weeknight Lemon Chicken" }),
    );
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
      }),
    );

    expect(
      screen.getByRole("heading", { name: "No recipe ideas for those ingredients" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 recipe(s) suggested")).toBeInTheDocument();
    expect(screen.queryByText("Check your meal preferences")).not.toBeInTheDocument();
    expect(screen.queryByText("Too much store data to rank at once")).not.toBeInTheDocument();
  });

  it("renders honest empty-meal copy and TheMealDB schedule info together when rank returns zero meals (C1)", () => {
    const marketSearchState: MarketSearchState = { status: "ready", market };
    const recommendationState: RecommendationState = {
      status: "ready",
      recommendations: [],
      shopperNotice: {
        title: "No recipe ideas for those ingredients",
        body: "Try selecting more sale items, widening your budget or ingredient limit.",
      },
      supplementaryShopperNotices: [
        {
          title: "TheMealDB imports refresh on a schedule",
          body: "Sale-matched TheMealDB meals use saved imports from the scheduled ingest job.",
        },
      ],
    };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [],
        shopperNotice: recommendationState.shopperNotice,
        supplementaryShopperNotices: recommendationState.supplementaryShopperNotices,
        marketBlocked: false,
      }),
    );

    expect(
      screen.getByRole("heading", { name: "No recipe ideas for those ingredients" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "TheMealDB imports refresh on a schedule" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "No recipes match the current filters" }),
    ).not.toBeInTheDocument();
  });

  it("shows Tier C badge copy when ranked stores are unavailable", () => {
    const blockedMarket = buildTestMarket({
      recommendationReadyStoreCount: 0,
      saleIngredientChoices: [],
      nearbyStores: [
        buildTestNearbyStoreSummary({
          id: "context-1",
          name: "Context Store",
          latitude: 37.6,
          longitude: -77.3,
          distanceMiles: 1,
          chain: "unknown",
          chainLabel: "Other",
          rolloutStatus: "limited-coverage",
          recommendationEnabled: false,
          rolloutNote: "Context only.",
          locationProvenance: "osm-context",
          locationBadge: "Map context pin",
          locationNote: "Fixture.",
        }),
      ],
      message: "Map context only — ranked meal estimates are limited coverage here.",
    });
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

  it("uses redesign flow copy in the idle ready-when-you-are state", () => {
    const marketSearchState: MarketSearchState = {
      status: "ready",
      market,
    };
    const recommendationState: RecommendationState = { status: "idle" };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [],
        marketBlocked: false,
      }),
    );

    expect(
      screen.getByText(/Finish pantry check on the Home tab/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Step 3/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Suggest recipes using my selected ingredients/i),
    ).not.toBeInTheDocument();
  });

  it("shows Cook-surface idle copy when rankings were cleared (B5)", () => {
    const marketSearchState: MarketSearchState = {
      status: "ready",
      market,
    };
    const recommendationState: RecommendationState = { status: "idle" };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [],
        marketBlocked: false,
        surface: "cook",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Suggest recipes on Home first" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/After store or preference changes, suggest recipes again on Home/i),
    ).toBeInTheDocument();
  });

  it("does not render the removed trust explainer modal trigger", () => {
    const marketSearchState: MarketSearchState = {
      status: "ready",
      market,
    };
    const recommendationState: RecommendationState = {
      status: "ready",
      recommendations: [recommendation],
    };

    render(
      createElement(MealResultsPanel, {
        form,
        marketSearchState,
        recommendationState,
        market,
        recommendations: [recommendation],
        marketBlocked: false,
      }),
    );

    expect(
      screen.queryByRole("button", { name: "How to read these labels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "How to read these results" }),
    ).not.toBeInTheDocument();
  });
});
