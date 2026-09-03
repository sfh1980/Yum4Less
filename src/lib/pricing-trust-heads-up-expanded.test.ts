import { describe, expect, it } from "vitest";
import {
  collectPricingTrustHeadsUpDetailText,
  FORBIDDEN_TRUST_CLAIM_PATTERNS,
  PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
} from "@/lib/pricing-trust-heads-up-expanded";

describe("pricing-trust-heads-up-expanded", () => {
  it("keeps plain-language honesty topics without ops jargon", () => {
    const text = collectPricingTrustHeadsUpDetailText(
      PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
    );

    expect(text).toContain("What these prices mean");
    expect(text).toContain("estimated");
    expect(text).toContain("directional");
    expect(text).toContain("limited coverage");
    expect(text).toContain("Kroger-family banners");
    expect(text).toContain("Walmart");
    expect(text).toContain("Lidl stays on the map");
    expect(text).toContain("verify");
    expect(text).not.toMatch(/promotion gates/i);
    expect(text).not.toMatch(/daily ingest/i);
    expect(text).not.toMatch(/\bOSM\b/);
    expect(text).not.toMatch(/24-hour cache/i);
  });

  it("uses a short three-section shopper outline", () => {
    const headings = PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS.map(
      (section) => section.heading,
    );

    expect(headings).toEqual([
      "What these prices mean",
      "Which stores",
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
