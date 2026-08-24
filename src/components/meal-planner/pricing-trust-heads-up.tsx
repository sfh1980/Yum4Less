"use client";

import { HelpHint } from "@/components/help-hint";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import {
  buildPricingTrustHeadsUp,
  type PricingTrustHeadsUpContext,
} from "@/lib/pricing-trust-heads-up";
import { FAQ_SLUG } from "@/lib/faq-articles";

type PricingTrustHeadsUpBannerProps = {
  market?: RecommendationExperience["market"];
  instanceId?: string;
  trustContext?: PricingTrustHeadsUpContext;
  /** `icon` = lone ? next to a heading. Default banner stays on map/discovery. */
  variant?: "banner" | "icon";
};

export function PricingTrustHeadsUpBanner({
  market,
  instanceId,
  trustContext,
  variant = "banner",
}: PricingTrustHeadsUpBannerProps) {
  if (!market) {
    return null;
  }

  const headsUp = buildPricingTrustHeadsUp(market, trustContext);
  if (!headsUp) {
    return null;
  }

  const helpId = `pricing-trust-heads-up-${instanceId ?? "default"}-help`;
  const helpHint = (
    <HelpHint id={helpId} articleSlug={FAQ_SLUG.priceSource} />
  );

  if (variant === "icon") {
    return <span className="trust-heads-up-icon">{helpHint}</span>;
  }

  const titleId = `pricing-trust-heads-up-${instanceId ?? "default"}-title`;

  return (
    <aside aria-labelledby={titleId} className="trust-heads-up" role="note">
      <div className="trust-heads-up-title-row">
        <h3 className="trust-heads-up-title" id={titleId}>
          {headsUp.title}
        </h3>
        {helpHint}
      </div>
      <p className="trust-heads-up-copy">{headsUp.message}</p>
    </aside>
  );
}
