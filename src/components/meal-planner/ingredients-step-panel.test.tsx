// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IngredientsStepPanel } from "@/components/meal-planner/ingredients-step-panel";
import {
  buildReadyMarketSearchState,
  buildTestMarket,
  buildTierCMarket,
} from "@/components/meal-planner/test-fixtures";

describe("IngredientsStepPanel", () => {
  const baseProps = {
    rankingPaused: false,
    marketSearchLoading: false,
    shoppingStyle: "single-store" as const,
    selectedIngredientIds: [] as string[],
    onToggleIngredient: vi.fn(),
    onSelectAllIngredients: vi.fn(),
    onClearIngredientSelection: vi.fn(),
    onContinueToPantry: vi.fn(),
    onPickManually: vi.fn(),
    onUseAllIngredients: vi.fn(),
  };

  it("shows the ingredient gate when pick mode is unset", () => {
    render(
      createElement(IngredientsStepPanel, {
        ...baseProps,
        market: buildTestMarket(),
        ingredientPickMode: "unset",
      }),
    );

    expect(screen.getByRole("button", { name: "Use all ingredients and check pantry" })).toBeInTheDocument();
    expect(screen.getByText(/estimated/i)).toBeInTheDocument();
  });

  it("shows manual picker when pick mode is manual", () => {
    render(
      createElement(IngredientsStepPanel, {
        ...baseProps,
        market: buildTestMarket(),
        ingredientPickMode: "manual",
        selectedIngredientIds: ["chicken-thighs"],
      }),
    );

    expect(screen.getByRole("checkbox", { name: /Chicken thighs/i })).toBeInTheDocument();
  });

  it("does not show continue when pick mode is all (use-all skips to pantry in flow)", () => {
    render(
      createElement(IngredientsStepPanel, {
        ...baseProps,
        market: buildTestMarket(),
        ingredientPickMode: "all",
      }),
    );

    expect(
      screen.queryByRole("button", { name: "Continue to pantry check" }),
    ).not.toBeInTheDocument();
  });

  it("disables continue in manual mode when Tier C market has zero sale ingredients", () => {
    render(
      createElement(IngredientsStepPanel, {
        ...baseProps,
        market: buildTierCMarket(),
        ingredientPickMode: "manual",
      }),
    );

    expect(screen.getByRole("button", { name: "Continue to pantry check" })).toBeDisabled();
    expect(screen.getByText(/No sale ingredients are available/i)).toBeInTheDocument();
  });

  it("continues to pantry from manual mode", async () => {
    const onContinueToPantry = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(IngredientsStepPanel, {
        ...baseProps,
        market: buildTestMarket(),
        ingredientPickMode: "manual",
        selectedIngredientIds: ["chicken-thighs"],
        onContinueToPantry,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Continue to pantry check" }));
    expect(onContinueToPantry).toHaveBeenCalledOnce();
  });

  it("disables continue in manual mode until at least one ingredient is selected", () => {
    render(
      createElement(IngredientsStepPanel, {
        ...baseProps,
        market: buildTestMarket(),
        ingredientPickMode: "manual",
        selectedIngredientIds: [],
      }),
    );

    expect(screen.getByRole("button", { name: "Continue to pantry check" })).toBeDisabled();
  });
});
