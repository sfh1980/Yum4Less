// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  IngredientGatePanel,
  PICK_SALE_ITEMS_LABEL,
  USE_ALL_SALE_ITEMS_LABEL,
} from "@/components/meal-planner/ingredient-gate-panel";

describe("IngredientGatePanel", () => {
  it("explains both choices in plain language", () => {
    render(
      createElement(IngredientGatePanel, {
        ingredientCount: 3,
        onPickManually: vi.fn(),
        onUseAll: vi.fn(),
      }),
    );

    expect(
      screen.getByText((_, node) =>
        node?.textContent === "We found 3 items on sale at the stores you chose.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/use all of these sale items to suggest dinners/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/pick which sale items to use/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /see if these additional items are in your pantry to give you more dinner options/i,
      ),
    ).toHaveLength(2);
    expect(screen.getByText(/estimates/i)).toBeInTheDocument();
    expect(screen.getByText(/Check prices in the store/i)).toBeInTheDocument();
  });

  it("calls onUseAll when the primary action is clicked", async () => {
    const onUseAll = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(IngredientGatePanel, {
        ingredientCount: 2,
        onPickManually: vi.fn(),
        onUseAll,
      }),
    );

    await user.click(screen.getByRole("button", { name: USE_ALL_SALE_ITEMS_LABEL }));
    expect(onUseAll).toHaveBeenCalledOnce();
  });

  it("calls onPickManually when the choose-items action is clicked", async () => {
    const onPickManually = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(IngredientGatePanel, {
        ingredientCount: 1,
        onPickManually,
        onUseAll: vi.fn(),
      }),
    );

    expect(
      screen.getByText((_, node) =>
        node?.textContent === "We found 1 item on sale at the stores you chose.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: PICK_SALE_ITEMS_LABEL }));
    expect(onPickManually).toHaveBeenCalledOnce();
  });
});
