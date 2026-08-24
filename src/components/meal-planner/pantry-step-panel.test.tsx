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
        category: "seasoning" as const,
        recipeCount: 2,
      },
    ],
    pantryRows: [],
    selectedPantryIngredientIds: [],
    onToggleChecklistItem: vi.fn(),
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

    expect(screen.getByText(/dinners can be shown next/i)).toBeInTheDocument();
    expect(document.querySelector(".pantry-step-summary--sticky")).not.toBeNull();
    expect(screen.queryByRole("combobox", { name: "Add a pantry item" })).not.toBeInTheDocument();
    const suggestButton = screen.getByRole("button", {
      name: "Suggest recipes for my store(s)",
    });
    expect(suggestButton).toBeEnabled();
    await user.click(suggestButton);
    expect(onSuggestRecipes).toHaveBeenCalledOnce();
  });

  it("keeps a checked suggested item in the list", () => {
    render(
      createElement(PantryStepPanel, {
        ...baseProps,
        selectedPantryIngredientIds: ["cumin"],
      }),
    );

    const checkbox = screen.getByRole("checkbox", { name: /Ground cumin/i });
    expect(checkbox).toBeChecked();
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

  it("renders combined pantry rows", async () => {
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
        ],
        selectedPantryIngredientIds: ["cumin"],
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /Your pantry for this session \(1 item\)/i }),
    );

    expect(
      screen.getByRole("region", { name: "Your pantry selections" }),
    ).toHaveTextContent("Ground cumin");
    expect(screen.queryByText("You added")).not.toBeInTheDocument();
  });
});
