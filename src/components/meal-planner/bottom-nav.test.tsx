// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/meal-planner/bottom-nav";

describe("BottomNav", () => {
  it("keeps Home/Deals/Cook/Saved/Feedback tappable before setup is complete", () => {
    const onTabChange = vi.fn();
    render(
      createElement(BottomNav, {
        activeTab: "settings",
        onTabChange,
      }),
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Home" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Feedback" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Settings" })).toHaveClass(
      "bottom-nav-button--active",
    );
    expect(
      screen.getByRole("button", { name: "Settings" }).querySelector("svg"),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onTabChange).toHaveBeenCalledWith("home");
  });

  it("can open Feedback from the nav after setup", () => {
    const onTabChange = vi.fn();
    render(
      createElement(BottomNav, {
        activeTab: "home",
        onTabChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    expect(onTabChange).toHaveBeenCalledWith("feedback");
  });
});
