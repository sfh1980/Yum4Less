// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaleIngredientPicker } from "@/components/meal-planner/sale-ingredient-picker";
import { buildSaleIngredientChoices } from "@/components/meal-planner/test-fixtures";

describe("SaleIngredientPicker", () => {
  it("renders trust labels for estimated and directional offers", () => {
    render(
      createElement(SaleIngredientPicker, {
        choices: buildSaleIngredientChoices(),
        selectedIngredientIds: [],
        shoppingStyle: "single-store",
        onToggleIngredient: vi.fn(),
        onSelectAll: vi.fn(),
        onClearSelection: vi.fn(),
      }),
    );

    expect(screen.getByText(/Online cache — estimated/i)).toBeInTheDocument();
    expect(screen.getByText(/Sale price — estimate only/i)).toBeInTheDocument();
  });

  it("selects and clears ingredients", async () => {
    const onToggleIngredient = vi.fn();
    const onSelectAll = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(SaleIngredientPicker, {
        choices: buildSaleIngredientChoices(),
        selectedIngredientIds: [],
        shoppingStyle: "single-store",
        onToggleIngredient,
        onSelectAll,
        onClearSelection: vi.fn(),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it("filters rows by search query", async () => {
    const user = userEvent.setup();

    render(
      createElement(SaleIngredientPicker, {
        choices: buildSaleIngredientChoices(),
        selectedIngredientIds: [],
        shoppingStyle: "single-store",
        onToggleIngredient: vi.fn(),
        onSelectAll: vi.fn(),
        onClearSelection: vi.fn(),
      }),
    );

    await user.type(screen.getByLabelText("Search ingredients"), "beans");
    expect(screen.getByText("Black beans")).toBeInTheDocument();
    expect(screen.queryByText("Chicken thighs")).not.toBeInTheDocument();
  });
});
