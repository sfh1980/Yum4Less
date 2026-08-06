"use client";

import type { PublicAnalyticsEventRow } from "@/lib/analytics/analytics-repository";

type OwnerAnalyticsFeedProps = {
  rows: PublicAnalyticsEventRow[];
  notice?: string;
};

function truncateSessionId(sessionId: string | null): string {
  if (!sessionId) {
    return "—";
  }
  if (sessionId.length <= 12) {
    return sessionId;
  }
  return `${sessionId.slice(0, 8)}…`;
}

export function OwnerAnalyticsFeed({ rows, notice }: OwnerAnalyticsFeedProps) {
  return (
    <div className="owner-analytics-feed">
      {notice ? (
        <p className="field-hint" role="status">
          {notice}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="panel-copy">No recent analytics events in Postgres.</p>
      ) : (
        <ul className="feedback-feed owner-analytics-list">
          {rows.map((row) => (
            <li className="feedback-feed-item card" key={row.id}>
              <div className="feedback-feed-meta">
                <span className="badge">{row.eventName}</span>
                <time dateTime={row.receivedAt}>
                  {new Date(row.receivedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                <span className="owner-analytics-env">{row.appEnv}</span>
              </div>
              <p className="feedback-feed-line">
                <strong>Session:</strong> {truncateSessionId(row.sessionId)}
              </p>
              <pre className="owner-analytics-properties">
                {JSON.stringify(row.properties ?? {}, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
