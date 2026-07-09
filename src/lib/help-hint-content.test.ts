import { describe, expect, it } from "vitest";
import { FORBIDDEN_TRUST_CLAIM_PATTERNS } from "@/lib/pricing-trust-heads-up-expanded";
import {
  confidenceLabelHelp,
  freshnessLabelHelp,
  mealPriceSourceHelp,
  mealTotalHelp,
  nearbyStoresMapHelp,
  pricingTrustHeadsUpHelp,
  radiusHelp,
  recipeSourceHelp,
  zipCodeHelp,
} from "@/lib/help-hint-content";

const HELP_HINT_COPY_BLOCKS = [
  zipCodeHelp,
  radiusHelp,
  mealTotalHelp,
  confidenceLabelHelp,
  freshnessLabelHelp,
  pricingTrustHeadsUpHelp,
  recipeSourceHelp,
  nearbyStoresMapHelp,
  mealPriceSourceHelp,
] as const;

function collectHelpHintText(): string {
  return HELP_HINT_COPY_BLOCKS.flatMap((block) => [
    block.tooltip,
    block.popoverTitle,
    block.popoverContent,
  ]).join(" ");
}

describe("help-hint-content", () => {
  it("forbidden-claim patterns do not match shopper-facing help hint copy", () => {
    const text = collectHelpHintText();

    for (const pattern of FORBIDDEN_TRUST_CLAIM_PATTERNS) {
      expect(text).not.toMatch(pattern);
    }
  });
});
