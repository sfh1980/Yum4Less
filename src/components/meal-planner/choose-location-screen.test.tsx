// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChooseLocationScreen } from "@/components/meal-planner/choose-location-screen";
import { RESET_PREFERENCES_BUTTON_LABEL } from "@/lib/reset-preferences-copy";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    id?: string;
    "aria-label"?: string;
  }) => createElement("a", { href, ...props }, children),
}));

describe("ChooseLocationScreen legal links", () => {
  it("shows FAQ, Terms, and Reset Preferences", () => {
    render(
      createElement(ChooseLocationScreen, {
        gpsRequesting: false,
        onUseGps: vi.fn(),
        onEnterZip: vi.fn(),
        onFactoryReset: vi.fn(),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Let’s get started" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Terms of use" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      screen.getByRole("button", { name: RESET_PREFERENCES_BUTTON_LABEL }),
    ).toBeInTheDocument();
  });
});
