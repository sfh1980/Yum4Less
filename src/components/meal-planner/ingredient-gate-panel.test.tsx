// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IngredientGatePanel } from "@/components/meal-planner/ingredient-gate-panel";

describe("IngredientGatePanel", () => {
  it("shows estimated and directional trust copy", () => {
    render(
      createElement(IngredientGatePanel, {
        ingredientCount: 3,
        onPickManually: vi.fn(),
        onUseAll: vi.fn(),
      }),
    );

    expect(screen.getByText(/estimated/i)).toBeInTheDocument();
    expect(screen.getByText(/directional/i)).toBeInTheDocument();
    expect(screen.getByText(/verify price, package size/i)).toBeInTheDocument();
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

    await user.click(
      screen.getByRole("button", { name: "Use all ingredients and check pantry" }),
    );
    expect(onUseAll).toHaveBeenCalledOnce();
  });

  it("shows the unified use-all action label", () => {
    render(
      createElement(IngredientGatePanel, {
        ingredientCount: 1,
        onPickManually: vi.fn(),
        onUseAll: vi.fn(),
      }),
    );

    expect(
      screen.getByRole("button", { name: "Use all ingredients and check pantry" }),
    ).toBeInTheDocument();
  });
});
