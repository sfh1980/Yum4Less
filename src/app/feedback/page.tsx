import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";
import {
  FEEDBACK_ISSUE_TYPES,
  type FeedbackIssueType,
} from "@/lib/feedback/feedback-types";

export const dynamic = "force-dynamic";

type FeedbackPageProps = {
  searchParams: Promise<{ topic?: string | string[] }>;
};

function readIssueType(topic: string | string[] | undefined): FeedbackIssueType {
  const value = Array.isArray(topic) ? topic[0] : topic;
  if (value && (FEEDBACK_ISSUE_TYPES as readonly string[]).includes(value)) {
    return value as FeedbackIssueType;
  }
  return "general";
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const feedbackEnabled = isFeedbackEnabled();
  const { topic } = await searchParams;
  const initialIssueType = readIssueType(topic);

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Yum4Less Beta · Feedback</p>
        <h1>Send feedback, report a wrong price, or ask us to add a store.</h1>
        <p className="hero-copy">
          Anonymous tips on prices, bugs, missing stores, or ideas. Don&apos;t include
          personal info.
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
            Please skip ZIP codes, street addresses, receipts, or contact details. A
            city name is enough when you ask us to add a store.
          </p>
          <FeedbackForm enabled={feedbackEnabled} initialIssueType={initialIssueType} />
        </section>
      </div>
    </main>
  );
}
