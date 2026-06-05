import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { FeedbackRecentFeed } from "@/components/feedback/feedback-recent-feed";
import {
  ANALYTICS_COLLECTED_WHEN_ENABLED,
  ANALYTICS_NEVER_COLLECTED,
  getAnalyticsEventAllowlistForDisplay,
  isClientAnalyticsEnabled,
  isServerAnalyticsEnabled,
} from "@/lib/feedback/analytics-transparency";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";
import { listRecentCustomerFeedback } from "@/lib/feedback/feedback-repository";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const feedbackEnabled = isFeedbackEnabled();
  let recentFeedback: Awaited<ReturnType<typeof listRecentCustomerFeedback>> = [];
  let recentFeedbackError: string | null = null;

  if (feedbackEnabled) {
    try {
      recentFeedback = await listRecentCustomerFeedback();
    } catch {
      recentFeedbackError = "Recent feedback could not be loaded right now.";
    }
  }
  const analyticsEnabled = isClientAnalyticsEnabled() && isServerAnalyticsEnabled();
  const analyticsEvents = analyticsEnabled ? getAnalyticsEventAllowlistForDisplay() : [];

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less Beta · Feedback</p>
        <h1>Send feedback or report a wrong price.</h1>
        <p className="hero-copy">
          Anonymous feedback helps improve store coverage, pricing trust labels, and the
          meal-planning flow. This page is separate from first-party analytics — use the
          form below for complaints, bugs, wrong-price reports, and product ideas.
        </p>
        <p className="hero-copy">
          <Link className="text-link" href="/">
            Back to meal planner
          </Link>
        </p>
      </section>

      <div className="feedback-layout">
        <section className="panel panel-padding">
          <h2>Feedback form</h2>
          <p className="panel-copy">
            Reports are stored without login. Please do not include ZIP codes, addresses,
            exact coordinates, checkout receipts, or personal contact details.
          </p>
          <FeedbackForm enabled={feedbackEnabled} />
        </section>

        <section className="panel panel-padding">
          <h2>Recent public feedback</h2>
          <p className="panel-copy">
            A sanitized feed of the latest anonymous submissions when feedback storage is
            enabled.
          </p>
          {recentFeedbackError ? (
            <p className="field-error" role="status">
              {recentFeedbackError}
            </p>
          ) : (
            <FeedbackRecentFeed rows={recentFeedback} />
          )}
        </section>

        <section className="panel panel-padding feedback-analytics-panel">
          <h2>Analytics transparency</h2>
          <p className="panel-copy">
            Yum4Less analytics are first-party, coarse, and off by default. They are not
            the same as customer feedback above.
          </p>

          <h3>What analytics never collect</h3>
          <ul className="feedback-list">
            {ANALYTICS_NEVER_COLLECTED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>What analytics may collect when enabled</h3>
          <p className="panel-copy">
            Both flags must be set: <code>NEXT_PUBLIC_YUM4LESS_ANALYTICS=1</code> on the
            client and <code>YUM4LESS_ENABLE_ANALYTICS=1</code> on the server.
          </p>
          <ul className="feedback-list">
            {ANALYTICS_COLLECTED_WHEN_ENABLED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {analyticsEnabled ? (
            <>
              <h3>Allowlisted analytics events</h3>
              <p className="panel-copy">
                Only these event names and properties are accepted by{" "}
                <code>/api/analytics/events</code>.
              </p>
              <ul className="feedback-allowlist">
                {analyticsEvents.map((entry) => (
                  <li className="feedback-allowlist-item" key={entry.eventName}>
                    <code>{entry.eventName}</code>
                    {entry.properties.length > 0 ? (
                      <span> — properties: {entry.properties.join(", ")}</span>
                    ) : (
                      <span> — no extra properties</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="panel-copy">
              Analytics are currently disabled in this environment, so no allowlisted
              events are being recorded.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
