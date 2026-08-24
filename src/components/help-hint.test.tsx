// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HelpHint } from "@/components/help-hint";
import { FAQ_SLUG } from "@/lib/faq-articles";

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

describe("HelpHint", () => {
  it("links the question mark to the matching FAQ article", () => {
    render(
      createElement(HelpHint, {
        id: "zip-help",
        articleSlug: FAQ_SLUG.zip,
      }),
    );

    const trigger = screen.getByRole("link", {
      name: "How does ZIP code search work? Opens FAQ",
    });
    expect(trigger).toHaveAttribute("href", "/faq/how-does-zip-search-work");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
