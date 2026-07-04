"use client";

import Link from "next/link";
import { useId } from "react";
import type { RecommendationExperience } from "@/lib/recommendation-service";
import { HelpHint } from "@/components/help-hint";
import { buildPricingTrustHeadsUp } from "@/lib/pricing-trust-heads-up";
import {
  PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS,
  PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY,
} from "@/lib/pricing-trust-heads-up-expanded";
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
  const detailsId = `pricing-trust-heads-up-${idPrefix}-details`;

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
      <details className="trust-heads-up-details" id={detailsId}>
        <summary className="trust-heads-up-details-summary">
          {PRICING_TRUST_HEADS_UP_EXPAND_SUMMARY}
        </summary>
        <div className="trust-heads-up-details-body">
          {PRICING_TRUST_HEADS_UP_DETAIL_SECTIONS.map((section) => (
            <section
              aria-labelledby={`${detailsId}-${section.heading.replace(/\s+/g, "-").toLowerCase()}`}
              className="trust-heads-up-detail-section"
              key={section.heading}
            >
              <h4
                className="trust-heads-up-detail-heading"
                id={`${detailsId}-${section.heading.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {section.heading}
              </h4>
              {section.paragraphs.map((paragraph) => (
                <p className="trust-heads-up-detail-copy" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <p className="trust-heads-up-detail-copy">
            <Link className="text-link" href="/feedback">
              Send feedback or report a wrong price
            </Link>
          </p>
        </div>
      </details>
    </aside>
  );
}
