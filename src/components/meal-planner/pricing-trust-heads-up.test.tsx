// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PricingTrustHeadsUpBanner } from "@/components/meal-planner/pricing-trust-heads-up";
import { buildTestMarketSummary, buildTestProviderCoverageRollup } from "@/lib/test-fixtures/contract-fixtures";
import { FAQ_SLUG, faqArticleHref } from "@/lib/faq-articles";

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

const marketWithStoreContext = buildTestMarketSummary({
  providerStoreSearches: [
    {
      provider: "kroger",
      label: "Kroger official store discovery",
      status: "available",
      provenance: "official-api",
      retrievalMode: "live",
      configured: true,
      fallbackUsed: false,
      stores: [],
      message: "Fixture store search.",
      fetchedAt: "2026-05-20T12:00:00.000Z",
    },
  ],
  providerCoverageRollup: buildTestProviderCoverageRollup({
    rankedPricingSource: "weekly-ad-cache",
  }),
  lookupSource: "geocodio",
  lookupProviderConfigured: true,
  recommendationReadyStoreCount: 1,
});

describe("PricingTrustHeadsUpBanner", () => {
  it("renders a one-line heads-up and links ? to the price-source FAQ", () => {
    render(
      createElement(PricingTrustHeadsUpBanner, {
        market: marketWithStoreContext,
        instanceId: "test",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "Heads up about these prices" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Meal prices are estimates/i)).toBeInTheDocument();
    expect(screen.queryByText("More about these estimates")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Where do these prices come from? Opens FAQ",
      }),
    ).toHaveAttribute("href", faqArticleHref(FAQ_SLUG.priceSource));
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

  it("renders only a question-mark FAQ link in icon variant", () => {
    render(
      createElement(PricingTrustHeadsUpBanner, {
        market: marketWithStoreContext,
        instanceId: "test-icon",
        variant: "icon",
      }),
    );

    expect(
      screen.queryByRole("heading", { name: "Heads up about these prices" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Meal prices are estimates/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Where do these prices come from? Opens FAQ",
      }),
    ).toHaveAttribute("href", faqArticleHref(FAQ_SLUG.priceSource));
  });
});
