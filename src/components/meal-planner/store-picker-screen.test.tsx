// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StorePickerScreen } from "@/components/meal-planner/store-picker-screen";
import { testForm } from "@/components/meal-planner/test-fixtures";
import { buildTestMarket } from "@/components/meal-planner/test-fixtures";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";

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

describe("StorePickerScreen coverage help", () => {
  it("shows a short coverage line and links the question mark to FAQ", () => {
    const kroger = buildTestNearbyStoreSummary({
      id: "kroger-1",
      chain: "kroger",
      chainLabel: "Kroger",
      matchedIngredientCount: 96,
      totalTrackedIngredientCount: 250,
    });
    const publix = buildTestNearbyStoreSummary({
      id: "publix-1",
      chain: "publix",
      chainLabel: "Publix",
      name: "Publix",
      matchedIngredientCount: 36,
      totalTrackedIngredientCount: 250,
    });

    render(
      createElement(StorePickerScreen, {
        form: {
          ...testForm,
          shoppingStyle: "multi-store",
          selectedStoreIds: ["kroger-1", "publix-1"],
        },
        setShoppingStyleSelection: vi.fn(),
        market: buildTestMarket({
          nearbyStores: [kroger, publix],
        }),
        marketSearchLoading: false,
        marketSearchState: { status: "ready" },
        showFactoryReset: false,
        onContinue: vi.fn(),
        onFactoryReset: vi.fn(),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Which stores should we use?" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sale-price coverage/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("Near you this week: Kroger ~96/250 · Publix ~36/250."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Why do some stores only appear on the map? Opens FAQ",
      }),
    ).toHaveAttribute(
      "href",
      "/faq/why-do-some-stores-only-appear-on-the-map",
    );
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Terms of use" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("lets shoppers select grocery without dinner estimates, including Whole Foods", () => {
    const kroger = buildTestNearbyStoreSummary({
      id: "kroger-1",
      chain: "kroger",
      chainLabel: "Kroger",
      recommendationEnabled: true,
    });
    const wholeFoods = buildTestNearbyStoreSummary({
      id: "whole-foods-1",
      chain: "unknown",
      chainLabel: "Other stores",
      name: "Whole Foods Market",
      recommendationEnabled: false,
      rolloutNote:
        "Shown on the map for nearby planning — dinner price estimates are not available from this store yet.",
    });

    render(
      createElement(StorePickerScreen, {
        form: {
          ...testForm,
          shoppingStyle: "multi-store",
          selectedStoreIds: ["kroger-1"],
        },
        setShoppingStyleSelection: vi.fn(),
        market: buildTestMarket({
          nearbyStores: [kroger, wholeFoods],
        }),
        marketSearchLoading: false,
        marketSearchState: { status: "ready" },
        showFactoryReset: false,
        onContinue: vi.fn(),
        onFactoryReset: vi.fn(),
      }),
    );

    const wholeFoodsBox = screen.getByRole("checkbox", {
      name: /Select Whole Foods Market/i,
    });
    expect(wholeFoodsBox).toBeEnabled();
    expect(wholeFoodsBox).not.toBeChecked();
    expect(
      screen.getByText(/dinner price estimates are not available from this store yet/i),
    ).toBeInTheDocument();
  });
});
