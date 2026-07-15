// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/meal-planner/bottom-nav";

describe("BottomNav Settings-first gate", () => {
  it("disables Home/Deals/Cook/Saved until settings are complete", () => {
    const onTabChange = vi.fn();
    render(
      createElement(BottomNav, {
        activeTab: "settings",
        settingsComplete: false,
        cookEnabled: false,
        onTabChange,
      }),
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Home" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deals" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cook" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("enables main tabs after setup while Cook stays recipe-gated", () => {
    const onTabChange = vi.fn();
    render(
      createElement(BottomNav, {
        activeTab: "home",
        settingsComplete: true,
        cookEnabled: false,
        onTabChange,
      }),
    );

    expect(screen.getByRole("button", { name: "Home" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deals" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Saved" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cook" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Deals" }));
    expect(onTabChange).toHaveBeenCalledWith("deals");
  });
});
