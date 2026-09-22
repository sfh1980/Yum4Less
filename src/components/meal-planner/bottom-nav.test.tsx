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
    const settingsButton = screen.getByRole("button", { name: "Settings" });
    expect(settingsButton.querySelector("svg")).not.toBeNull();
    expect(settingsButton).toHaveAttribute("data-tab", "settings");
    expect(settingsButton.querySelector("[data-tab-icon='settings']")).not.toBeNull();

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

  it("uses filled Mock1 tab icons with a per-tab color hook", () => {
    render(
      createElement(BottomNav, {
        activeTab: "home",
        onTabChange: vi.fn(),
      }),
    );

    const labels: Record<string, string> = {
      home: "Home",
      deals: "Deals",
      cook: "Cook",
      saved: "Saved",
      feedback: "Feedback",
      settings: "Settings",
    };
    for (const tab of Object.keys(labels)) {
      const icon = screen.getByRole("button", { name: labels[tab] }).querySelector("svg");
      expect(icon).toHaveAttribute("data-tab-icon", tab);
      expect(icon).toHaveAttribute("fill", "currentColor");
      expect(icon).toHaveClass(`bottom-nav-button-icon--${tab}`);
    }
  });
});
