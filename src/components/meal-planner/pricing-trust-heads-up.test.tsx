// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PricingTrustHeadsUpBanner } from "@/components/meal-planner/pricing-trust-heads-up";
import {
  collectPricingTrustHeadsUpDetailText,
  FORBIDDEN_TRUST_CLAIM_PATTERNS,
  PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
  PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY,
} from "@/lib/pricing-trust-heads-up-expanded";

const marketWithStoreContext = {
  providerStoreSearches: [
    {
      fallbackUsed: false,
    },
  ],
  providerPricingPreviews: [],
  providerCoverageRollup: {
    rankedPricingSource: "weekly-ad-cache" as const,
  },
  lookupSource: "geocodio" as const,
  dataSource: "database" as const,
  lookupProviderConfigured: true,
  recommendationReadyStoreCount: 1,
};

function getTrustDetails(container: HTMLElement): HTMLDetailsElement {
  const details = container.querySelector(".trust-heads-up-details");
  if (!(details instanceof HTMLDetailsElement)) {
    throw new Error("Expected trust heads-up details element");
  }
  return details;
}

describe("PricingTrustHeadsUpBanner expanded disclosure", () => {
  it("renders the inline heads-up copy and collapsed expand control", () => {
    const { container } = render(
      createElement(PricingTrustHeadsUpBanner, {
        market: marketWithStoreContext,
        instanceId: "test",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Heads up about these prices" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Meal prices are estimates/i)).toBeInTheDocument();
    expect(screen.getByText(PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY)).toBeInTheDocument();
    expect(getTrustDetails(container).open).toBe(false);
  });

  it("reveals recovered modal sections when expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(
      createElement(PricingTrustHeadsUpBanner, {
        market: marketWithStoreContext,
        instanceId: "test-expand",
      }),
    );

    const details = getTrustDetails(container);
    const summary = within(details).getByText(PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY);
    await user.click(summary);
    expect(details.open).toBe(true);

    expect(
      screen.getByRole("heading", { name: "Chain coverage" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Chain coverage" }),
      ).getByText(/Kroger-family, Aldi, Publix, and Food Lion/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Freshness" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/24-hour cache/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sale confidence" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fallback" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/limited coverage/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Walmart and other map pins" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Send feedback or report a wrong price" }),
    ).toHaveAttribute("href", "/feedback");
  });

  it("does not render the removed trust explainer modal trigger", () => {
    render(
      createElement(PricingTrustHeadsUpBanner, {
        market: marketWithStoreContext,
        instanceId: "test-no-modal",
      }),
    );

    expect(
      screen.queryByRole("button", { name: "How to read these labels" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "How to read these results" }),
    ).not.toBeInTheDocument();
  });
});

describe("pricing trust expanded copy — forbidden claims (M156)", () => {
  it("static expanded sections avoid forbidden positive claims", () => {
    const detailText = collectPricingTrustHeadsUpDetailText(
      PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
    );

    for (const pattern of FORBIDDEN_TRUST_CLAIM_PATTERNS) {
      expect(detailText).not.toMatch(pattern);
    }
  });

  it("expanded banner DOM avoids forbidden positive claims after disclosure opens", async () => {
    const user = userEvent.setup();
    const { container } = render(
      createElement(PricingTrustHeadsUpBanner, {
        market: marketWithStoreContext,
        instanceId: "test-forbidden",
      }),
    );

    const details = getTrustDetails(container);
    await user.click(within(details).getByText(PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY));

    const bannerText = container.querySelector(".trust-heads-up")?.textContent ?? "";

    for (const pattern of FORBIDDEN_TRUST_CLAIM_PATTERNS) {
      expect(bannerText).not.toMatch(pattern);
    }
  });
});
