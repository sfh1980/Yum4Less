// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MapOnlyCoverageNotice } from "@/components/meal-planner/map-only-coverage-notice";
import { ShoppingStyleScreen } from "@/components/meal-planner/shopping-style-screen";

describe("ShoppingStyleScreen", () => {
  it("advances as soon as a shopping style is chosen", () => {
    const onShoppingStyleChange = vi.fn();
    const onContinue = vi.fn();
    render(
      createElement(ShoppingStyleScreen, {
        shoppingStyle: "single-store",
        onShoppingStyleChange,
        onContinue,
      }),
    );

    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Several stores" }));
    expect(onShoppingStyleChange).toHaveBeenCalledWith("multi-store");
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "One store" }));
    expect(onShoppingStyleChange).toHaveBeenCalledWith("single-store");
    expect(onContinue).toHaveBeenCalledTimes(2);
  });

  it("shows a map-only reason before the shopper continues to stores", () => {
    const reason =
      "Yum4Less found nearby stores, but none have enough sale prices for dinner estimates right now. Other map pins may be for planning only.";
    render(
      createElement(ShoppingStyleScreen, {
        shoppingStyle: "single-store",
        coverageNotice: createElement(MapOnlyCoverageNotice, { reason }),
        onShoppingStyleChange: vi.fn(),
        onContinue: vi.fn(),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(reason);
    expect(screen.getByRole("heading", { name: "How do you shop?" })).toBeInTheDocument();
  });
});
