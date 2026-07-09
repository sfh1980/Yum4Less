// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PantryStepPanel } from "@/components/meal-planner/pantry-step-panel";

describe("PantryStepPanel", () => {
  const baseProps = {
    loading: false,
    fullyCoveredRecipeCount: 2,
    eligibleRecipeCount: 5,
    suggestedChecklist: [
      {
        ingredientId: "cumin",
        ingredientName: "Ground cumin",
        category: "seasoning",
        recipeCount: 2,
      },
    ],
    pantryRows: [],
    ingredientCatalog: [{ id: "olive-oil", name: "Olive oil", category: "pantry" }],
    selectedPantryIngredientIds: [],
    onToggleChecklistItem: vi.fn(),
    onAddPantryIngredient: vi.fn(),
    onRemovePantryIngredient: vi.fn(),
    rankingPaused: false,
    rankLoading: false,
    onSuggestRecipes: vi.fn(),
  };

  it("shows suggest recipes enabled when ranking is available", async () => {
    const user = userEvent.setup();
    const onSuggestRecipes = vi.fn();

    render(
      createElement(PantryStepPanel, {
        ...baseProps,
        suggestedChecklist: [],
        fullyCoveredRecipeCount: 0,
        onSuggestRecipes,
      }),
    );

    expect(screen.getByText(/No meals are 1–4 items away/i)).toBeInTheDocument();
    const suggestButton = screen.getByRole("button", {
      name: "Suggest recipes for my store(s)",
    });
    expect(suggestButton).toBeEnabled();
    await user.click(suggestButton);
    expect(onSuggestRecipes).toHaveBeenCalledOnce();
  });

  it("disables suggest recipes when ranking is paused", () => {
    render(
      createElement(PantryStepPanel, {
        ...baseProps,
        rankingPaused: true,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Suggest recipes for my store(s)" }),
    ).toBeDisabled();
  });

  it("disables suggest recipes while rank request is loading", () => {
    render(
      createElement(PantryStepPanel, {
        ...baseProps,
        rankLoading: true,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Suggest recipes for my store(s)" }),
    ).toBeDisabled();
  });

  it("renders combined pantry rows with source badges", async () => {
    const user = userEvent.setup();

    render(
      createElement(PantryStepPanel, {
        ...baseProps,
        pantryRows: [
          {
            ingredientId: "cumin",
            ingredientName: "Ground cumin",
            source: "suggested",
            recipeCount: 2,
          },
          {
            ingredientId: "olive-oil",
            ingredientName: "Olive oil",
            source: "manual",
          },
        ],
        selectedPantryIngredientIds: ["cumin", "olive-oil"],
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /Your pantry for this session \(2 items\)/i }),
    );

    expect(screen.getByText("Suggested")).toBeInTheDocument();
    expect(screen.getByText("You added")).toBeInTheDocument();
  });
});
