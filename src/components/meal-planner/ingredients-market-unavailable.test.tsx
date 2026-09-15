// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IngredientsMarketUnavailable } from "@/components/meal-planner/ingredients-market-unavailable";
import {
  buildErrorMarketSearchState,
  buildLoadingMarketSearchState,
} from "@/components/meal-planner/test-fixtures";

describe("IngredientsMarketUnavailable", () => {
  it("shows loading status while market search is in flight", () => {
    render(
      createElement(IngredientsMarketUnavailable, {
        marketSearchLoading: true,
        marketSearchState: buildLoadingMarketSearchState(),
      }),
    );

    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Loading sale ingredients from your saved Settings/i,
    );
  });

  it("shows an alert when market search fails", () => {
    render(
      createElement(IngredientsMarketUnavailable, {
        marketSearchLoading: false,
        marketSearchState: buildErrorMarketSearchState(
          "Nearby store search failed on the server.",
        ),
      }),
    );

    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nearby store search failed on the server.",
    );
  });

  it("shows infrastructure outage copy when prices are not loading", () => {
    render(
      createElement(IngredientsMarketUnavailable, {
        marketSearchLoading: false,
        marketSearchState: buildErrorMarketSearchState(
          "Store and meal prices are not loading right now. Try again shortly.",
        ),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Ingredients aren't loading" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/not loading right now/i);
    expect(screen.getByRole("alert").textContent).not.toMatch(/Complete Settings/i);
  });

  it("shows fallback alert text when error message is missing", () => {
    render(
      createElement(IngredientsMarketUnavailable, {
        marketSearchLoading: false,
        marketSearchState: { status: "error" },
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load sale ingredients for your area.",
    );
  });

  it("prompts to complete Settings when idle with no market", () => {
    render(
      createElement(IngredientsMarketUnavailable, {
        marketSearchLoading: false,
        marketSearchState: { status: "idle" },
      }),
    );

    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
    expect(
      screen.getByText(/Complete Settings with a location and store selection/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
