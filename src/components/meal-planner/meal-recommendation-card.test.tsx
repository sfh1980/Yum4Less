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
  it("labels the meal total as estimated currency", () => {
    renderCard();

    expect(screen.getByText("Est. $13.42")).toBeInTheDocument();
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
    expect(screen.getByText("Est. $13.42")).toBeInTheDocument();
  });

  it("opens the store map when the primary store pill is tapped", () => {
    const onOpenStoreMap = vi.fn();
    renderCard({ onOpenStoreMap });

    fireEvent.click(screen.getAllByRole("button", { name: "Show Kroger on map" })[0]!);

    expect(onOpenStoreMap).toHaveBeenCalledWith(
      expect.objectContaining({ id: "kroger-mechanicsville", name: "Kroger" }),
    );
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
});
