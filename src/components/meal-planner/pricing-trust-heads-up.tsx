"use client";

import { useId } from "react";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import { HelpHint } from "@/components/help-hint";
import { buildPricingTrustHeadsUp } from "@/lib/pricing-trust-heads-up";
import { pricingTrustHeadsUpHelp } from "@/lib/help-hint-content";

type PricingTrustHeadsUpBannerProps = {
  market?: RecommendationExperience["market"];
  instanceId?: string;
};

export function PricingTrustHeadsUpBanner({
  market,
  instanceId,
}: PricingTrustHeadsUpBannerProps) {
  const generatedId = useId();
  const idPrefix = instanceId ?? generatedId;
  const titleId = `pricing-trust-heads-up-${idPrefix}-title`;
  const helpId = `pricing-trust-heads-up-${idPrefix}-help`;

  if (!market) {
    return null;
  }

  const headsUp = buildPricingTrustHeadsUp(market);
  if (!headsUp) {
    return null;
  }

  return (
    <aside
      aria-labelledby={titleId}
      className="trust-heads-up"
      role="note"
    >
      <div className="trust-heads-up-title-row">
        <h3 className="trust-heads-up-title" id={titleId}>
          {headsUp.title}
        </h3>
        <HelpHint
          id={helpId}
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
