// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RecommendationResultsCarousel } from "@/components/recommendation-results-carousel";

describe("RecommendationResultsCarousel", () => {
  it("swipes between recommendation cards with next and previous controls", async () => {
    render(
      createElement(
        RecommendationResultsCarousel,
        { ariaLabel: "Ranked dinner recommendations" },
        createElement("article", { key: "one" }, "First dinner"),
        createElement("article", { key: "two" }, "Second dinner"),
      ),
    );

    expect(screen.getByText("First dinner")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next recommendation" }));

    expect(screen.getByText(/2 of 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous recommendation" }));

    expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
  });
});
