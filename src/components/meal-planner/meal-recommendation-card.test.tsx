// @vitest-environment jsdom

import { createElement, type ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MealRecommendationCard } from "@/components/meal-planner/meal-recommendation-card";
import { buildTestMarket, buildTestMeal, testForm } from "@/components/meal-planner/test-fixtures";

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
          {
            id: "kroger-mechanicsville",
            name: "Kroger",
            city: "Mechanicsville",
            state: "VA",
            kind: "grocery",
            latitude: 37.6153,
            longitude: -77.3491,
            distanceMiles: 1.2,
            chain: "kroger",
            chainLabel: "Kroger",
            rolloutStatus: "weekly-ad-preview",
            recommendationEnabled: true,
            rolloutNote: "Fixture.",
            locationProvenance: "bootstrap",
            locationBadge: "Catalog coordinates",
            locationNote: "Seed.",
          },
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
});
