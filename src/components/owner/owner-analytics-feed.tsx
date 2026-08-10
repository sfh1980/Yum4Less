"use client";

import type { PublicAnalyticsEventRow } from "@/lib/analytics/analytics-repository";

type OwnerAnalyticsFeedProps = {
  rows: PublicAnalyticsEventRow[];
  notice?: string;
};

type SessionGroup = {
  sessionKey: string;
  sessionId: string | null;
  events: PublicAnalyticsEventRow[];
  latestAt: string;
};

function truncateSessionId(sessionId: string | null): string {
  if (!sessionId) {
    return "No session id";
  }
  if (sessionId.length <= 16) {
    return sessionId;
  }
  return `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

/** Group events by session; newest session first; events within session oldest→newest. */
export function groupAnalyticsEventsBySession(
  rows: PublicAnalyticsEventRow[],
): SessionGroup[] {
  const bySession = new Map<string, PublicAnalyticsEventRow[]>();

  for (const row of rows) {
    const key = row.sessionId?.trim() || "__none__";
    const list = bySession.get(key);
    if (list) {
      list.push(row);
    } else {
      bySession.set(key, [row]);
    }
  }

  const groups: SessionGroup[] = [];
  for (const [sessionKey, events] of bySession) {
    const sorted = [...events].sort((a, b) => {
      const time = a.receivedAt.localeCompare(b.receivedAt);
      return time !== 0 ? time : a.id - b.id;
    });
    const latestAt = sorted.reduce(
      (latest, row) => (row.receivedAt > latest ? row.receivedAt : latest),
      sorted[0]!.receivedAt,
    );
    groups.push({
      sessionKey,
      sessionId: sessionKey === "__none__" ? null : sessionKey,
      events: sorted,
      latestAt,
    });
  }

  return groups.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

export function OwnerAnalyticsFeed({ rows, notice }: OwnerAnalyticsFeedProps) {
  const sessions = groupAnalyticsEventsBySession(rows);

  return (
    <div className="owner-analytics-feed">
      {notice ? (
        <p className="field-hint" role="status">
          {notice}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="panel-copy">No analytics events in Postgres yet.</p>
      ) : (
        <div className="owner-analytics-sessions">
          <p className="panel-copy">
            Showing {rows.length} event{rows.length === 1 ? "" : "s"} across{" "}
            {sessions.length} session{sessions.length === 1 ? "" : "s"} (loaded
            pages).
          </p>
          {sessions.map((session) => (
            <section
              className="owner-analytics-session card"
              key={session.sessionKey}
            >
              <header className="owner-analytics-session-header">
                <h3 className="owner-analytics-session-title">
                  Session · {truncateSessionId(session.sessionId)}
                </h3>
                <span className="badge">
                  {session.events.length} event
                  {session.events.length === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="feedback-feed owner-analytics-list">
                {session.events.map((row) => (
                  <li className="feedback-feed-item" key={row.id}>
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
                    <pre className="owner-analytics-properties">
                      {JSON.stringify(row.properties ?? {}, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
