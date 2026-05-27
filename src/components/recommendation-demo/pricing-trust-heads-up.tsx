"use client";

import type { RecommendationExperience } from "@/lib/recommendation-service";
import { HelpHint } from "@/components/help-hint";
import { buildPricingTrustHeadsUp } from "@/lib/pricing-trust-heads-up";
import { pricingTrustHeadsUpHelp } from "@/lib/help-hint-content";

type PricingTrustHeadsUpBannerProps = {
  market?: RecommendationExperience["market"];
};

export function PricingTrustHeadsUpBanner({ market }: PricingTrustHeadsUpBannerProps) {
  if (!market) {
    return null;
  }

  const headsUp = buildPricingTrustHeadsUp(market);
  if (!headsUp) {
    return null;
  }

  return (
    <aside
      aria-labelledby="pricing-trust-heads-up-title"
      className="trust-heads-up"
      role="note"
    >
      <div className="trust-heads-up-title-row">
        <h3 className="trust-heads-up-title" id="pricing-trust-heads-up-title">
          {headsUp.title}
        </h3>
        <HelpHint
          id="pricing-trust-heads-up-help"
          label="Price trust signals help"
          popoverContent={pricingTrustHeadsUpHelp.popoverContent}
          popoverTitle={pricingTrustHeadsUpHelp.popoverTitle}
          tooltip={pricingTrustHeadsUpHelp.tooltip}
        />
      </div>
      <p className="trust-heads-up-copy">{headsUp.message}</p>
    </aside>
  );
}
