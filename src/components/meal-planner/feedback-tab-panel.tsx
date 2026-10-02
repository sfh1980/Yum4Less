"use client";

import { FeedbackForm } from "@/components/feedback/feedback-form";
import { HelpLegalLinks } from "@/components/help-legal-links";

type FeedbackTabPanelProps = {
  enabled: boolean;
};

export function FeedbackTabPanel({ enabled }: FeedbackTabPanelProps) {
  return (
    <section className="wizard-screen" aria-labelledby="feedback-tab-title">
      <h1 id="feedback-tab-title" className="wizard-title">
        Send feedback, report a wrong price, or ask us to add a store.
      </h1>
      <p className="wizard-copy">
        Anonymous tips on prices, bugs, missing stores, or ideas. Don&apos;t include
        personal info. Please skip ZIP codes, street addresses, receipts, or contact
        details. A city name is enough when you ask us to add a store.
      </p>
      <FeedbackForm enabled={enabled} />
      <HelpLegalLinks includeFeedback={false} />
    </section>
  );
}
