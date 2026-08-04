/**
 * Short shopper-facing trust detail inside the expandable
 * `PricingTrustHeadsUpBanner` disclosure (collapsed heads-up stays separate).
 */
import type { MarketSummary } from "@/lib/recommendation-service";
import { buildChainCoverageDepthLiveSummary } from "@/lib/chain-coverage-honesty";

export type PricingTrustHeadsUpDetailSection = {
  heading: string;
  paragraphs: readonly string[];
};

export const PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY =
  "More about these estimates";

/** Keep honesty keywords; drop ops jargon (ingest, gates, OSM, cache internals). */
export const PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS: readonly PricingTrustHeadsUpDetailSection[] =
  [
    {
      heading: "What these prices mean",
      paragraphs: [
        "Meal totals are helpful estimates, not guaranteed checkout prices. Labels like estimated, directional, or limited coverage mean you should verify shelf tags before you buy.",
      ],
    },
    {
      heading: "Which stores",
      paragraphs: [
        "Dinner estimates can use Kroger-family, Aldi, Publix, and Food Lion when we have recent sale or online price data near you. Walmart and other map pins are nearby context only — not used for meal totals.",
      ],
    },
    {
      heading: "Before you shop",
      paragraphs: [
        "Prices refresh about daily. Older info is a rougher guide. Always check package size and in-store tags.",
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
    if (section.heading !== "Which stores" || !liveCoverageSummary) {
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
