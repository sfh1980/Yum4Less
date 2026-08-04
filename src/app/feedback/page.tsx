import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const feedbackEnabled = isFeedbackEnabled();

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less Beta · Feedback</p>
        <h1>Send feedback or report a wrong price.</h1>
        <p className="hero-copy">
          Anonymous tips on prices, bugs, or ideas. Don&apos;t include personal info.
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
            Please skip ZIP codes, addresses, receipts, or contact details.
          </p>
          <FeedbackForm enabled={feedbackEnabled} />
        </section>
      </div>
    </main>
  );
}
