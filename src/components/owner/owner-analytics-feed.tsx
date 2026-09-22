"use client";

import { useMemo, useState } from "react";
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

export type AnalyticsScoreboard = {
  loadedEventCount: number;
  loadedSessionCount: number;
  locationSearchStarted: number;
  locationSearchCompleted: number;
  locationSearchFailed: number;
  rankStarted: number;
  rankCompleted: number;
  rankFailed: number;
  rankZeroDinners: number;
  storePinSelected: number;
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

function countName(rows: PublicAnalyticsEventRow[], eventName: string): number {
  return rows.filter((row) => row.eventName === eventName).length;
}

export function summarizeAnalyticsEvents(
  rows: PublicAnalyticsEventRow[],
): AnalyticsScoreboard {
  const sessions = groupAnalyticsEventsBySession(rows);
  return {
    loadedEventCount: rows.length,
    loadedSessionCount: sessions.length,
    locationSearchStarted: countName(rows, "location_search_started"),
    locationSearchCompleted: countName(rows, "location_search_completed"),
    locationSearchFailed: countName(rows, "location_search_failed"),
    rankStarted: countName(rows, "rank_meals_started"),
    rankCompleted: countName(rows, "rank_meals_completed"),
    rankFailed: countName(rows, "rank_meals_failed"),
    rankZeroDinners: rows.filter(
      (row) =>
        row.eventName === "rank_meals_completed" &&
        row.properties.result_count_bucket === "0",
    ).length,
    storePinSelected: countName(rows, "store_pin_selected"),
  };
}

function sessionFinishedRank(session: SessionGroup): boolean {
  return session.events.some((row) => row.eventName === "rank_meals_completed");
}

function sessionEventNames(session: SessionGroup): string {
  return [...new Set(session.events.map((row) => row.eventName))].join(" · ");
}

export function OwnerAnalyticsFeed({ rows, notice }: OwnerAnalyticsFeedProps) {
  const sessions = groupAnalyticsEventsBySession(rows);
  const scoreboard = summarizeAnalyticsEvents(rows);
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());
  const [openEventIds, setOpenEventIds] = useState<Set<number>>(new Set());
  const [eventFilter, setEventFilter] = useState("all");

  const filteredSessions = useMemo(() => {
    if (eventFilter === "all") {
      return sessions;
    }
    return sessions
      .map((session) => ({
        ...session,
        events: session.events.filter((row) => row.eventName === eventFilter),
      }))
      .filter((session) => session.events.length > 0);
  }, [eventFilter, sessions]);

  function toggleSession(sessionKey: string) {
    setOpenSessions((current) => {
      const next = new Set(current);
      if (next.has(sessionKey)) {
        next.delete(sessionKey);
      } else {
        next.add(sessionKey);
      }
      return next;
    });
  }

  function toggleEvent(id: number) {
    setOpenEventIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
            Counts below are this loaded page ({scoreboard.loadedEventCount}{" "}
            event{scoreboard.loadedEventCount === 1 ? "" : "s"} /{" "}
            {scoreboard.loadedSessionCount} session
            {scoreboard.loadedSessionCount === 1 ? "" : "s"}), not all-time.
            Client-stamped properties are directional only — not trust ground
            truth.
          </p>
          <ul className="owner-analytics-scoreboard">
            <li>Location searches started: {scoreboard.locationSearchStarted}</li>
            <li>Location searches finished: {scoreboard.locationSearchCompleted}</li>
            <li>Location searches failed: {scoreboard.locationSearchFailed}</li>
            <li>Ranks started: {scoreboard.rankStarted}</li>
            <li>Ranks finished: {scoreboard.rankCompleted}</li>
            <li>Ranks failed: {scoreboard.rankFailed}</li>
            <li>Ranks with zero dinners: {scoreboard.rankZeroDinners}</li>
            <li>Pins selected: {scoreboard.storePinSelected}</li>
          </ul>
          <label className="field" htmlFor="owner-analytics-event-filter">
            <span className="field-label">Event type</span>
            <select
              id="owner-analytics-event-filter"
              onChange={(event) => setEventFilter(event.target.value)}
              value={eventFilter}
            >
              <option value="all">All loaded events</option>
              <option value="location_search_started">Location searches started</option>
              <option value="location_search_completed">Location searches finished</option>
              <option value="location_search_failed">Location searches failed</option>
              <option value="rank_meals_started">Ranks started</option>
              <option value="rank_meals_completed">Ranks finished</option>
              <option value="rank_meals_failed">Ranks failed</option>
              <option value="store_pin_selected">Pins selected</option>
            </select>
          </label>
          {filteredSessions.map((session) => {
            const open = openSessions.has(session.sessionKey);
            return (
              <section
                className="owner-analytics-session card"
                key={session.sessionKey}
              >
                <header className="owner-analytics-session-header">
                  <button
                    className="owner-analytics-session-toggle"
                    onClick={() => toggleSession(session.sessionKey)}
                    type="button"
                    aria-expanded={open}
                  >
                    <h3 className="owner-analytics-session-title">
                      Session · {truncateSessionId(session.sessionId)}
                    </h3>
                    <span className="badge">
                      {session.events.length} event
                      {session.events.length === 1 ? "" : "s"}
                      {sessionFinishedRank(session) ? " · rank finished" : ""}
                    </span>
                  </button>
                </header>
                <p className="panel-copy owner-analytics-session-summary">
                  {sessionEventNames(session)}
                </p>
                {open ? (
                  <ul className="feedback-feed owner-analytics-list">
                    {session.events.map((row) => {
                      const detailsOpen = openEventIds.has(row.id);
                      return (
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
                          <button
                            className="secondary-button"
                            onClick={() => toggleEvent(row.id)}
                            type="button"
                            aria-expanded={detailsOpen}
                          >
                            {detailsOpen ? "Hide properties" : "Show properties"}
                          </button>
                          {detailsOpen ? (
                            <pre className="owner-analytics-properties">
                              {JSON.stringify(row.properties ?? {}, null, 2)}
                            </pre>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
