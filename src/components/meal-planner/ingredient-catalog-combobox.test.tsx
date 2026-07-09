// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IngredientCatalogCombobox } from "@/components/meal-planner/ingredient-catalog-combobox";

const catalog = [
  { id: "olive-oil", name: "Olive oil", category: "pantry" as const },
  { id: "chicken-breast", name: "Chicken breast", category: "protein" as const },
  { id: "chicken-thighs", name: "Chicken thighs", category: "protein" as const },
  { id: "sugar", name: "Sugar", category: "baking" as const },
];

describe("IngredientCatalogCombobox", () => {
  it("adds a valid catalog match and confirms the effect", async () => {
    const user = userEvent.setup();
    const onSelectIngredient = vi.fn();

    render(
      createElement(IngredientCatalogCombobox, {
        catalog,
        selectedIngredientIds: [],
        nearMissRecipeCountByIngredientId: new Map([["sugar", 2]]),
        onSelectIngredient,
      }),
    );

    await user.type(screen.getByRole("combobox"), "Sugar");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSelectIngredient).toHaveBeenCalledWith({
      ingredientId: "sugar",
      ingredientName: "Sugar",
      nearMissRecipeCount: 2,
    });
    expect(screen.getByText(/Added Sugar — helps 2 near-miss recipes/i)).toBeInTheDocument();
  });

  it("resolves fuzzy partial input to a catalog ingredient", async () => {
    const user = userEvent.setup();
    const onSelectIngredient = vi.fn();

    render(
      createElement(IngredientCatalogCombobox, {
        catalog,
        selectedIngredientIds: [],
        onSelectIngredient,
      }),
    );

    await user.type(screen.getByRole("combobox"), "chix");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSelectIngredient).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/did you mean/i);
  });

  it("rejects unknown input with explicit feedback instead of a silent no-op", async () => {
    const user = userEvent.setup();
    const onSelectIngredient = vi.fn();

    render(
      createElement(IngredientCatalogCombobox, {
        catalog,
        selectedIngredientIds: [],
        onSelectIngredient,
      }),
    );

    await user.type(screen.getByRole("combobox"), "zzzz-not-food");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSelectIngredient).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/don't recognize/i);
  });

  it("does not silently no-op when Enter is pressed on unknown free text", async () => {
    const user = userEvent.setup();
    const onSelectIngredient = vi.fn();

    render(
      createElement(IngredientCatalogCombobox, {
        catalog,
        selectedIngredientIds: [],
        onSelectIngredient,
      }),
    );

    await user.type(screen.getByRole("combobox"), "zzzz-not-food{Enter}");

    expect(onSelectIngredient).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/don't recognize/i);
  });
});
