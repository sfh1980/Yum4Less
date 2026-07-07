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
    onContinueToRank: vi.fn(),
  };

  it("always shows continue to rank enabled", async () => {
    const user = userEvent.setup();
    const onContinueToRank = vi.fn();

    render(
      createElement(PantryStepPanel, {
        ...baseProps,
        suggestedChecklist: [],
        fullyCoveredRecipeCount: 0,
        onContinueToRank,
      }),
    );

    expect(screen.getByText(/No meals are 1–4 items away/i)).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue to rank" });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(onContinueToRank).toHaveBeenCalledOnce();
  });

  it("renders combined pantry rows with source badges", () => {
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

    expect(screen.getByText("Suggested")).toBeInTheDocument();
    expect(screen.getByText("You added")).toBeInTheDocument();
  });
});
