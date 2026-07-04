import { describe, expect, it } from "vitest";
import {
  collectPricingTrustHeadsUpDetailText,
  FORBIDDEN_TRUST_CLAIM_PATTERNS,
  PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
} from "@/lib/pricing-trust-heads-up-expanded";

describe("pricing-trust-heads-up-expanded", () => {
  it("includes the key modal topics: chain coverage, cache, sale confidence, fallback", () => {
    const text = collectPricingTrustHeadsUpDetailText(
      PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
    );

    expect(text).toContain("Chain coverage");
    expect(text).toContain("Kroger-family, Aldi, Publix, and Food Lion");
    expect(text).toContain("24-hour cache");
    expect(text).toContain("Sale confidence");
    expect(text).toContain("Fallback");
    expect(text).toContain("limited coverage");
    expect(text).toContain("Walmart never feeds ranked meal totals");
  });

  it("covers every section recovered from trust-explainer-modal.tsx", () => {
    const headings = PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS.map(
      (section) => section.heading,
    );

    expect(headings).toEqual([
      "Beta v1",
      "Chain coverage",
      "Confidence labels",
      "Freshness",
      "Sale confidence",
      "Fallback",
      "Ranked v1 chains",
      "Walmart and other map pins",
      "Before you shop",
    ]);
  });

  it("forbidden-claim patterns do not match the static expanded copy", () => {
    const text = collectPricingTrustHeadsUpDetailText();

    for (const pattern of FORBIDDEN_TRUST_CLAIM_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});
