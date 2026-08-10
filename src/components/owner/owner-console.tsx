"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FeedbackRecentFeed } from "@/components/feedback/feedback-recent-feed";
import { OwnerAnalyticsFeed } from "@/components/owner/owner-analytics-feed";
import type { PublicAnalyticsEventRow } from "@/lib/analytics/analytics-repository";
import {
  FEEDBACK_LIMITS,
  type PublicFeedbackRow,
} from "@/lib/feedback/feedback-types";

const OWNER_ADMIN_KEY_STORAGE = "yum4less.owner-admin-key.v1";
const OWNER_PAGE_SIZE = FEEDBACK_LIMITS.ownerListDefault;

type LoadState = "idle" | "loading" | "ready" | "error";

function readStoredKey(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return sessionStorage.getItem(OWNER_ADMIN_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function writeStoredKey(key: string) {
  try {
    if (key) {
      sessionStorage.setItem(OWNER_ADMIN_KEY_STORAGE, key);
    } else {
      sessionStorage.removeItem(OWNER_ADMIN_KEY_STORAGE);
    }
  } catch {
    // sessionStorage may be unavailable; in-memory state still works for the tab.
  }
}

function authHeaders(key: string): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
  };
}

function mergeById<T extends { id: number }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  const merged = [...existing];
  for (const row of incoming) {
    if (!seen.has(row.id)) {
      merged.push(row);
      seen.add(row.id);
    }
  }
  return merged;
}

export function OwnerConsole() {
  const [draftKey, setDraftKey] = useState("");
  const [activeKey, setActiveKey] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadingMore, setLoadingMore] = useState<"feedback" | "analytics" | null>(
    null,
  );
  const [error, setError] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<PublicFeedbackRow[]>([]);
  const [events, setEvents] = useState<PublicAnalyticsEventRow[]>([]);
  const [feedbackHasMore, setFeedbackHasMore] = useState(false);
  const [analyticsHasMore, setAnalyticsHasMore] = useState(false);
  const [feedbackNextOffset, setFeedbackNextOffset] = useState(0);
  const [analyticsNextOffset, setAnalyticsNextOffset] = useState(0);
  const [analyticsNotice, setAnalyticsNotice] = useState<string | undefined>();

  useEffect(() => {
    const stored = readStoredKey();
    if (stored) {
      setDraftKey(stored);
      setActiveKey(stored);
    }
  }, []);

  const loadPage = useCallback(
    async (
      key: string,
      options: {
        reset: boolean;
        feedbackOffset: number;
        analyticsOffset: number;
        which?: "both" | "feedback" | "analytics";
      },
    ) => {
      if (!key.trim()) {
        setLoadState("idle");
        setError(undefined);
        setFeedback([]);
        setEvents([]);
        setFeedbackHasMore(false);
        setAnalyticsHasMore(false);
        setFeedbackNextOffset(0);
        setAnalyticsNextOffset(0);
        setAnalyticsNotice(undefined);
        return;
      }

      const which = options.which ?? "both";
      if (options.reset) {
        setLoadState("loading");
      } else if (which === "feedback") {
        setLoadingMore("feedback");
      } else if (which === "analytics") {
        setLoadingMore("analytics");
      }
      setError(undefined);

      try {
        const fetches: Promise<Response>[] = [];
        const fetchKinds: Array<"feedback" | "analytics"> = [];

        if (which === "both" || which === "feedback") {
          fetchKinds.push("feedback");
          fetches.push(
            fetch(
              `/api/feedback?limit=${OWNER_PAGE_SIZE}&offset=${options.feedbackOffset}`,
              { headers: authHeaders(key), cache: "no-store" },
            ),
          );
        }
        if (which === "both" || which === "analytics") {
          fetchKinds.push("analytics");
          fetches.push(
            fetch(
              `/api/analytics/events?limit=${OWNER_PAGE_SIZE}&offset=${options.analyticsOffset}`,
              { headers: authHeaders(key), cache: "no-store" },
            ),
          );
        }

        const responses = await Promise.all(fetches);
        if (responses.some((response) => response.status === 401)) {
          setLoadState("error");
          setError(
            "Wrong or missing admin key, or YUM4LESS_FEEDBACK_ADMIN_KEY is not set on the server.",
          );
          setFeedback([]);
          setEvents([]);
          setFeedbackHasMore(false);
          setAnalyticsHasMore(false);
          setFeedbackNextOffset(0);
          setAnalyticsNextOffset(0);
          setAnalyticsNotice(undefined);
          return;
        }

        for (let index = 0; index < responses.length; index += 1) {
          const kind = fetchKinds[index]!;
          const response = responses[index]!;
          const json = (await response.json()) as {
            ok?: boolean;
            feedback?: PublicFeedbackRow[];
            events?: PublicAnalyticsEventRow[];
            hasMore?: boolean;
            limit?: number;
            offset?: number;
            notice?: string;
            error?: string;
          };

          if (!response.ok || !json.ok) {
            setLoadState("error");
            setError(
              json.error ??
                (kind === "feedback"
                  ? "Could not load feedback."
                  : "Could not load analytics."),
            );
            return;
          }

          const pageOffset = json.offset ?? 0;

          if (kind === "feedback") {
            const page = json.feedback ?? [];
            setFeedback((current) =>
              options.reset ? page : mergeById(current, page),
            );
            setFeedbackHasMore(Boolean(json.hasMore));
            setFeedbackNextOffset(pageOffset + page.length);
          } else {
            const page = json.events ?? [];
            setEvents((current) =>
              options.reset ? page : mergeById(current, page),
            );
            setAnalyticsHasMore(Boolean(json.hasMore));
            setAnalyticsNextOffset(pageOffset + page.length);
            if (options.reset || json.notice) {
              setAnalyticsNotice(json.notice);
            }
          }
        }

        setLoadState("ready");
      } catch {
        setLoadState("error");
        setError(
          "Owner lists could not be loaded. Check the network and try again.",
        );
      } finally {
        setLoadingMore(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeKey) {
      return;
    }
    void loadPage(activeKey, {
      reset: true,
      feedbackOffset: 0,
      analyticsOffset: 0,
      which: "both",
    });
  }, [activeKey, loadPage]);

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = draftKey.trim();
    writeStoredKey(key);
    setActiveKey(key);
  }

  function handleClearKey() {
    setDraftKey("");
    setActiveKey("");
    writeStoredKey("");
    setLoadState("idle");
    setError(undefined);
    setFeedback([]);
    setEvents([]);
    setFeedbackHasMore(false);
    setAnalyticsHasMore(false);
    setFeedbackNextOffset(0);
    setAnalyticsNextOffset(0);
    setAnalyticsNotice(undefined);
  }

  function handleRefresh() {
    if (!activeKey) {
      return;
    }
    void loadPage(activeKey, {
      reset: true,
      feedbackOffset: 0,
      analyticsOffset: 0,
      which: "both",
    });
  }

  function handleLoadMoreFeedback() {
    if (!activeKey || !feedbackHasMore) {
      return;
    }
    void loadPage(activeKey, {
      reset: false,
      feedbackOffset: feedbackNextOffset,
      analyticsOffset: analyticsNextOffset,
      which: "feedback",
    });
  }

  function handleLoadMoreAnalytics() {
    if (!activeKey || !analyticsHasMore) {
      return;
    }
    void loadPage(activeKey, {
      reset: false,
      feedbackOffset: feedbackNextOffset,
      analyticsOffset: analyticsNextOffset,
      which: "analytics",
    });
  }
  return (
    <div className="owner-console">
      <section className="panel panel-padding">
        <h2>Unlock</h2>
        <p className="panel-copy">
          Enter the same value as <code>YUM4LESS_FEEDBACK_ADMIN_KEY</code>. The key
          stays in this tab&apos;s session storage only — it is never baked into the
          app build.
        </p>
        <form className="owner-unlock-form" onSubmit={handleUnlock}>
          <label className="field" htmlFor="owner-admin-key">
            <span className="field-label">Admin key</span>
            <input
              autoComplete="off"
              id="owner-admin-key"
              name="owner-admin-key"
              onChange={(event) => setDraftKey(event.target.value)}
              spellCheck={false}
              type="password"
              value={draftKey}
            />
          </label>
          <div className="action-row">
            <button className="primary-button" type="submit">
              View
            </button>
            <button
              className="secondary-button"
              onClick={handleClearKey}
              type="button"
            >
              Clear key
            </button>
            {activeKey ? (
              <button
                className="secondary-button"
                disabled={loadState === "loading"}
                onClick={handleRefresh}
                type="button"
              >
                Refresh
              </button>
            ) : null}
          </div>
        </form>
        {loadState === "loading" ? (
          <p className="panel-copy" role="status">
            Loading owner lists…
          </p>
        ) : null}
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {loadState === "ready" ? (
        <div className="owner-console-panels">
          <section className="panel panel-padding">
            <h2>Customer feedback</h2>
            <p className="panel-copy">
              Rows from <code>customer_feedback</code>, newest first. Loaded{" "}
              {feedback.length}
              {feedbackHasMore ? "+" : ""}.
            </p>
            <FeedbackRecentFeed
              emptyMessage="No feedback yet."
              rows={feedback}
            />
            {feedbackHasMore ? (
              <div className="action-row owner-load-more-row">
                <button
                  className="secondary-button"
                  disabled={loadingMore === "feedback"}
                  onClick={handleLoadMoreFeedback}
                  type="button"
                >
                  {loadingMore === "feedback"
                    ? "Loading…"
                    : `Show next ${OWNER_PAGE_SIZE} feedback`}
                </button>
              </div>
            ) : null}
          </section>

          <section className="panel panel-padding">
            <h2>Analytics by session</h2>
            <p className="panel-copy">
              Events from <code>analytics_events</code>, grouped by session.
              Loaded {events.length}
              {analyticsHasMore ? "+" : ""} (pages of {OWNER_PAGE_SIZE}).
            </p>
            <OwnerAnalyticsFeed notice={analyticsNotice} rows={events} />
            {analyticsHasMore ? (
              <div className="action-row owner-load-more-row">
                <button
                  className="secondary-button"
                  disabled={loadingMore === "analytics"}
                  onClick={handleLoadMoreAnalytics}
                  type="button"
                >
                  {loadingMore === "analytics"
                    ? "Loading…"
                    : `Show next ${OWNER_PAGE_SIZE} events`}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
