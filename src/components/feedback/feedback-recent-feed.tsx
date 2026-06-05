import type { PublicFeedbackRow } from "@/lib/feedback/feedback-types";

type FeedbackRecentFeedProps = {
  rows: PublicFeedbackRow[];
};

const ISSUE_TYPE_LABELS: Record<PublicFeedbackRow["issueType"], string> = {
  wrong_price: "Wrong price",
  missing_item: "Missing item",
  stale_ad: "Stale weekly ad",
  bug: "Bug report",
  general: "General feedback",
  other: "Other",
};

export function FeedbackRecentFeed({ rows }: FeedbackRecentFeedProps) {
  if (rows.length === 0) {
    return (
      <p className="panel-copy">
        No recent public feedback yet. Submissions appear here after they are saved.
      </p>
    );
  }

  return (
    <ul className="feedback-feed">
      {rows.map((row) => (
        <li className="feedback-feed-item card" key={row.id}>
          <div className="feedback-feed-meta">
            <span className="badge">{ISSUE_TYPE_LABELS[row.issueType]}</span>
            <time dateTime={row.receivedAt}>
              {new Date(row.receivedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </div>
          {row.chainLabel ? (
            <p className="feedback-feed-line">
              <strong>Chain:</strong> {row.chainLabel}
            </p>
          ) : null}
          {row.productDescription ? (
            <p className="feedback-feed-line">
              <strong>Product:</strong> {row.productDescription}
            </p>
          ) : null}
          {row.note ? <p className="explanation">{row.note}</p> : null}
        </li>
      ))}
    </ul>
  );
}
