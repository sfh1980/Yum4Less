// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecommendationDemo } from "@/components/recommendation-demo";

const fetchMock = vi.fn();

describe("RecommendationDemo", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("renders MVP-oriented results and trust guidance from the server response", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(successPayload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(RecommendationDemo));

    expect(screen.getByRole("heading", { name: "Search local dinner options" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dinner recommendations" })).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "How to read Yum4Less estimates" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Weeknight Lemon Chicken")).toBeInTheDocument();
    expect(screen.getAllByText("Postgres market data")).toHaveLength(2);
    expect(screen.getAllByText("Geocodio lookup")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "How to read Yum4Less estimates" }),
      ).not.toBeInTheDocument();
    });
  });
});

const successPayload = {
  ok: true,
  experience: {
    market: {
      searchedZipCode: "23111",
      locationLabel: "Mechanicsville, VA",
      radiusMiles: 5,
      nearbyStores: [
        {
          id: "kroger-1",
          name: "Kroger Mechanicsville",
          kind: "grocery",
          distanceMiles: 2.4,
        },
      ],
      lookupSource: "geocodio",
      providerConfigured: true,
      dataSource: "database",
      message: "Showing 1 nearby store within 5 miles using local PostgreSQL data.",
    },
    recommendations: [
      {
        title: "Weeknight Lemon Chicken",
        summary: "Simple roasted chicken and vegetables for a low-cost weeknight dinner.",
        estimatedTotal: 13.42,
        storeCount: 1,
        matchedIngredients: 5,
        cookTimeMinutes: 35,
        difficulty: "easy",
        primaryStore: "Kroger Mechanicsville",
        ingredientHighlights: ["chicken thighs", "baby potatoes", "broccoli"],
        instructions: ["Roast the chicken and vegetables until tender."],
        shoppingPlan: [
          {
            ingredient: "Chicken thighs",
            quantityNote: "2 lb family pack",
            storeName: "Kroger Mechanicsville",
            price: 6.49,
            freshnessDaysAgo: 1,
          },
        ],
        storePlan: [
          {
            storeName: "Kroger Mechanicsville",
            subtotal: 13.42,
            itemCount: 5,
          },
        ],
        score: {
          total: 74,
          price: 32,
          convenience: 22,
          freshness: 12,
          fit: 8,
        },
        confidenceLabel: "Single-store estimate",
        tags: ["family-friendly"],
        freshnessLabel: "Fresh pricing snapshot",
        explanation: "The meal fits the budget and keeps the trip simple.",
      },
    ],
  },
};
