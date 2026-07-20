// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealsPanel } from "@/components/meal-planner/deals-panel";
import {
  buildErrorMarketSearchState,
  buildLoadingMarketSearchState,
  buildReadyMarketSearchState,
  buildTestMarket,
  buildTierCMarket,
} from "@/components/meal-planner/test-fixtures";

describe("DealsPanel", () => {
  it("shows loading status while market search is in flight", () => {
    render(
      createElement(DealsPanel, {
        marketSearchLoading: true,
        marketSearchState: buildLoadingMarketSearchState(),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Loading sale items/i);
  });

  it("shows an alert when market search fails", () => {
    render(
      createElement(DealsPanel, {
        marketSearchLoading: false,
        marketSearchState: buildErrorMarketSearchState("Could not load deals."),
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Could not load deals.");
  });

  it("prompts to complete Settings when no market is loaded", () => {
    render(
      createElement(DealsPanel, {
        market: undefined,
        marketSearchLoading: false,
        marketSearchState: { status: "idle" },
      }),
    );

    expect(screen.getByText(/Complete Settings with a location/i)).toBeInTheDocument();
  });

  it("shows estimated and directional trust copy with sale items", () => {
    render(
      createElement(DealsPanel, {
        market: buildTestMarket(),
        marketSearchLoading: false,
        marketSearchState: buildReadyMarketSearchState(),
      }),
    );

    expect(screen.getByText(/Totals are/i)).toHaveTextContent("estimated");
    expect(screen.getByText(/Totals are/i)).toHaveTextContent("directional");
    expect(screen.getByText("Chicken thighs")).toBeInTheDocument();
    expect(screen.getByText("Lowest price we found: $6.49")).toBeInTheDocument();
    expect(screen.getAllByText("directional").length).toBeGreaterThan(0);
  });

  it("shows empty-state copy when Tier C market has no sale choices", () => {
    render(
      createElement(DealsPanel, {
        market: buildTierCMarket(),
        marketSearchLoading: false,
        marketSearchState: buildReadyMarketSearchState(buildTierCMarket()),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(/No sale items are available/i);
  });
});
