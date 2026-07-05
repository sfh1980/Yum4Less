// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RankStepPanel } from "@/components/meal-planner/rank-step-panel";

describe("RankStepPanel", () => {
  it("explains that ranked totals are estimated, not live checkout prices", () => {
    render(
      createElement(RankStepPanel, {
        rankingPaused: false,
        rankLoading: false,
        onRankMeals: vi.fn(),
      }),
    );

    expect(screen.getByText(/not live checkout totals/i)).toBeInTheDocument();
    expect(screen.getByText(/saved store prices at your selected store\(s\)/i)).toBeInTheDocument();
  });

  it("disables rank while loading", () => {
    render(
      createElement(RankStepPanel, {
        rankingPaused: false,
        rankLoading: true,
        onRankMeals: vi.fn(),
      }),
    );

    expect(screen.getByRole("button", { name: "Suggest recipes for my store(s)" })).toBeDisabled();
  });

  it("fires onRankMeals when enabled", async () => {
    const onRankMeals = vi.fn();
    const user = userEvent.setup();

    render(
      createElement(RankStepPanel, {
        rankingPaused: false,
        rankLoading: false,
        onRankMeals,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Suggest recipes for my store(s)" }));
    expect(onRankMeals).toHaveBeenCalledOnce();
  });
});
