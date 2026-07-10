/**
 * Long-form trust copy recovered from `trust-explainer-modal.tsx` (removed 2026-06-26).
 * Rendered inside the expandable `PricingTrustHeadsUpBanner` disclosure — not a modal.
 */
import type { MarketSummary } from "@/lib/recommendation-service";
import { buildChainCoverageDepthLiveSummary } from "@/lib/chain-coverage-honesty";

export type PricingTrustHeadsUpDetailSection = {
  heading: string;
  paragraphs: readonly string[];
};

export const PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY =
  "More about these estimates";

export const PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS: readonly PricingTrustHeadsUpDetailSection[] =
  [
    {
      heading: "Beta v1",
      paragraphs: [
        "Yum4Less is an early beta — read meal results as helpful estimates, not guaranteed final checkout totals.",
      ],
    },
    {
      heading: "Chain coverage",
      paragraphs: [
        "The current production release ranks dinners from Kroger-family, Aldi, Publix, and Food Lion when daily ingest and promotion gates pass. Walmart, OSM, and other unsupported pins are map context only—not live-priced sources for meal totals.",
      ],
    },
    {
      heading: "Chain coverage depth",
      paragraphs: [
        "Kroger-family stores can price most dinner ingredients from recently checked online catalog data. Aldi, Publix, and Food Lion ranked estimates use current weekly-ad sales only — a smaller share of the dinner-tracked list is on sale in any given week.",
        "Multi-store plans pick the lowest estimated priced item per ingredient across your selected stores. When another chain has fewer sale matches, more line items may route to the chain with deeper coverage — that is a data-source difference, not proof that other stores are farther away or have no deals.",
      ],
    },
    {
      heading: "Confidence labels",
      paragraphs: [
        "Confidence labels explain how simple the shopping plan is. Single-store estimates are usually easier to follow; multi-store plans compare prices across your selected stores but depend on more stops.",
      ],
    },
    {
      heading: "Freshness",
      paragraphs: [
        "Freshness tells you how recent the price information is. Ranked reads use a 24-hour cache refreshed by daily ingest — fresher rows are stronger signals, but electronic shelf labels and checkout systems can still change before you shop. Older pricing is more directional.",
      ],
    },
    {
      heading: "Sale confidence",
      paragraphs: [
        "Sale confidence on each line item tells you how much trust to place in an advertised deal. Weekly ads and recently checked online prices are not guaranteed checkout totals — verify current shelf tags in store.",
      ],
    },
    {
      heading: "Fallback",
      paragraphs: [
        "Fallback means the app kept working with backup data when a preferred source was unavailable. Look for labels like estimated, directional, or limited coverage before you shop.",
      ],
    },
    {
      heading: "Ranked v1 chains",
      paragraphs: [
        "Kroger-family, Aldi, Publix, and Food Lion ranked dinner estimates use scraped weekly-ad deals when ingested near you and promotion gates pass. Kroger-family can also use recently checked official Kroger online prices on that same gate path when available. Totals are estimated and directional for every chain—verify package size and in-store tags before checkout.",
      ],
    },
    {
      heading: "Walmart and other map pins",
      paragraphs: [
        "Walmart and other map pins may appear for nearby context only in this beta. Walmart never feeds ranked meal totals here; OSM and unsupported chains are map context only—not live-priced sources for meal totals.",
      ],
    },
    {
      heading: "Before you shop",
      paragraphs: [
        "Use these labels to judge how much confidence to place in a result before deciding what to cook or where to shop.",
      ],
    },
  ] as const;

export function buildPricingTrustHeadsUpDetailSections(
  market?: Pick<MarketSummary, "nearbyStores">,
): PricingTrustHeadsUpDetailSection[] {
  const nearbyStores = market?.nearbyStores ?? [];
  const liveCoverageSummary =
    nearbyStores.length > 0
      ? buildChainCoverageDepthLiveSummary(nearbyStores)
      : null;

  return PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS.map((section) => {
    if (section.heading !== "Chain coverage depth" || !liveCoverageSummary) {
      return {
        heading: section.heading,
        paragraphs: [...section.paragraphs],
      };
    }

    return {
      heading: section.heading,
      paragraphs: [...section.paragraphs, liveCoverageSummary],
    };
  });
}

/** M156-positive claims that must not appear in shopper-facing trust copy. */
export const FORBIDDEN_TRUST_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bcheapest\b/i,
  /\bbest deal\b/i,
  /\blive prices?\b/i,
  /\bhigh confidence\b/i,
  /\bproduction-ready\b/i,
  /\bdeploy-ready\b/i,
  /\bCI green\b/i,
  /\bbeta v1 demo-complete\b/i,
  /\bguaranteed\b(?!\s+(final|checkout))/i,
  /\bsave(?:s|d)?\s+(?:you\s+)?money\b/i,
];

export function collectPricingTrustHeadsUpDetailText(
  sections: readonly PricingTrustHeadsUpDetailSection[] = PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
): string {
  return sections
    .flatMap((section) => [section.heading, ...section.paragraphs])
    .join(" ");
}
