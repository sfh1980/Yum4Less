// @vitest-environment jsdom

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SPLASH_INTRO,
  SPLASH_TAGLINE,
  SPLASH_TRUST,
  SplashScreen,
} from "@/components/meal-planner/splash-screen";

describe("SplashScreen", () => {
  it("leads with a prominent Yum4Less title and plain-language intro", () => {
    const onContinue = vi.fn();
    render(createElement(SplashScreen, { onContinue }));

    expect(screen.getByRole("heading", { name: "Yum4Less" })).toBeInTheDocument();
    expect(screen.getByText(SPLASH_TAGLINE)).toBeInTheDocument();
    expect(screen.getByText(SPLASH_INTRO)).toBeInTheDocument();
    expect(screen.getByText(SPLASH_TRUST)).toBeInTheDocument();
    expect(screen.queryByText("Loading your setup…")).not.toBeInTheDocument();
    expect(screen.queryByText(/save money/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".splash-photo")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
