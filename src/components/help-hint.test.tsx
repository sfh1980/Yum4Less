// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HelpHint } from "@/components/help-hint";

describe("HelpHint", () => {
  it("shows tooltip text on focus and hides it on blur", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      createElement("div", null, [
        createElement(HelpHint, {
          id: "zip-help",
          key: "help",
          label: "ZIP code help",
          tooltip: "Local MVP area only.",
        }),
        createElement("button", { key: "next", type: "button" }, "Next"),
      ]),
    );

    const trigger = screen.getByRole("button", { name: "ZIP code help" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Local MVP area only.");

    await user.tab();
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("opens and closes the optional popover dialog", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      createElement(HelpHint, {
        id: "total-help",
        label: "Estimated meal total help",
        tooltip: "Estimated cost, not a checkout total.",
        popoverTitle: "Estimated meal total",
        popoverContent: "Verify price and deals in store.",
      }),
    );

    const trigger = screen.getByRole("button", { name: "Estimated meal total help" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Estimated meal total")).toBeInTheDocument();
    expect(screen.getByText("Verify price and deals in store.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the popover when Escape is pressed", async () => {
    const user = userEvent.setup({ delay: null });

    render(
      createElement(HelpHint, {
        id: "freshness-help",
        label: "Freshness label help",
        tooltip: "How recent the price data is.",
        popoverTitle: "Freshness label",
        popoverContent: "Older pricing is more directional.",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Freshness label help" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
