// @vitest-environment jsdom

import { createElement, type ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MealRecommendationCard } from "@/components/meal-planner/meal-recommendation-card";
import { buildTestMarket, buildTestMeal, testForm } from "@/components/meal-planner/test-fixtures";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

vi.mock("@/components/meal-planner/multi-store-route-panel", () => ({
  MultiStoreRoutePanel: () => null,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    id?: string;
    "aria-label"?: string;
  }) => createElement("a", { href, ...props }, children),
}));

const noopOpenStoreMap = vi.fn();

function renderCard(
  props: Partial<ComponentProps<typeof MealRecommendationCard>> = {},
) {
  return render(
    createElement(MealRecommendationCard, {
      meal: buildTestMeal(),
      form: testForm,
      market: buildTestMarket({
        nearbyStores: [
          buildTestNearbyStoreSummary({
            id: "kroger-mechanicsville",
            name: "Kroger",
            city: "Mechanicsville",
            state: "VA",
            latitude: 37.6153,
            longitude: -77.3491,
            distanceMiles: 1.2,
          }),
        ],
      }),
      onOpenStoreMap: noopOpenStoreMap,
      ...props,
    }),
  );
}

describe("MealRecommendationCard", () => {
  it("labels the meal total with confidence-flexed shopper wording", () => {
    renderCard();

    expect(screen.getByText("Lowest price we found: $13.42")).toBeInTheDocument();
  });

  it("shows trust pills for confidence and freshness labels", () => {
    renderCard({
      meal: buildTestMeal({
        confidenceLabel: "Single-store estimate",
        freshnessLabel: "Recent sale prices",
      }),
    });

    expect(screen.getByText("Single-store estimate")).toBeInTheDocument();
    expect(screen.getByText("Recent sale prices")).toBeInTheDocument();
  });

  it("hides the title when used inside an accordion trigger", () => {
    renderCard({
      meal: buildTestMeal({ title: "Hidden Title Meal" }),
      hideTitle: true,
    });

    expect(screen.queryByRole("heading", { name: "Hidden Title Meal" })).not.toBeInTheDocument();
    expect(screen.getByText("Lowest price we found: $13.42")).toBeInTheDocument();
  });

  it("opens the store map from the store plan, not the collapsed pill row", () => {
    const onOpenStoreMap = vi.fn();
    renderCard({ onOpenStoreMap });

    fireEvent.click(screen.getByRole("button", { name: "Store plan" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Show Kroger on map" })[0]!);

    expect(onOpenStoreMap).toHaveBeenCalledWith(
      expect.objectContaining({ id: "kroger-mechanicsville", name: "Kroger" }),
    );
  });

  it("hides extended chrome by default and restores it when asked", () => {
    const { rerender } = renderCard();

    expect(screen.queryByText(/Key ingredients/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/matched ingredients/i)).not.toBeInTheDocument();

    rerender(
      createElement(MealRecommendationCard, {
        meal: buildTestMeal(),
        form: testForm,
        market: buildTestMarket({
          nearbyStores: [
            buildTestNearbyStoreSummary({
              id: "kroger-mechanicsville",
              name: "Kroger",
              city: "Mechanicsville",
              state: "VA",
              latitude: 37.6153,
              longitude: -77.3491,
              distanceMiles: 1.2,
            }),
          ],
        }),
        onOpenStoreMap: noopOpenStoreMap,
        showExtendedChrome: true,
      }),
    );

    expect(screen.getByText(/Key ingredients/i)).toBeInTheDocument();
    expect(screen.getByText(/matched ingredients/i)).toBeInTheDocument();
  });

  it("renders pantry lines without store price claims", () => {
    renderCard({
      meal: buildTestMeal({
        shoppingPlan: [
          {
            ingredientId: "olive-oil",
            ingredient: "Olive oil",
            quantityNote: "1 bottle",
            sourcedFromPantry: true,
            price: 0,
            pantryNote: "From your pantry — not included in total",
            saleConfidence: {
              level: "no-sale-data",
              label: "From your pantry",
              note: "Not included in store total",
            },
          },
          {
            ingredientId: "chicken-thighs",
            ingredient: "Chicken thighs",
            quantityNote: "1.5 lb",
            sourcedFromPantry: false,
            storeName: "Kroger",
            price: 6.49,
            freshnessDaysAgo: 1,
            freshnessHoursAgo: 12,
            priceSource: "kroger-weekly-ad-scrape",
            priceSourceKind: "weekly-ad",
            priceSourceTier: 2,
            matchConfidence: 0.85,
            saleConfidence: {
              level: "advertised-recent",
              label: "Sale price — estimate only",
              note: "Fixture note.",
            },
          },
        ],
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Shopping plan" }));

    expect(screen.getByText(/from your pantry, not included in total/i)).toBeInTheDocument();
    expect(screen.getByText(/not included in the estimated total above/i)).toBeInTheDocument();
    expect(screen.queryByText(/Olive oil from Kroger/i)).not.toBeInTheDocument();
  });

  it("saves a meal snapshot from the recommendation card", () => {
    const onToggleSave = vi.fn();
    renderCard({ onToggleSave });

    fireEvent.click(screen.getByRole("button", { name: "Save meal" }));
    expect(onToggleSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(String) }),
    );
  });

  it("links to full recipe instructions when TheMealDB attribution exists", () => {
    renderCard({
      meal: buildTestMeal({
        recipeAttribution: "Recipe from TheMealDB",
        recipeAttributionUrl: "https://www.themealdb.com/meal/52772",
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Recipe steps" }));

    expect(
      screen.getByRole("link", { name: "Open full recipe instructions" }),
    ).toHaveAttribute("href", "https://www.themealdb.com/meal/52772");
  });

  it("does not invent a full-recipe link for internal dinners", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Recipe steps" }));

    expect(
      screen.queryByRole("link", { name: "Open full recipe instructions" }),
    ).not.toBeInTheDocument();
  });
});
