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
const OWNER_LIST_LIMIT = FEEDBACK_LIMITS.ownerListDefault;

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

export function OwnerConsole() {
  const [draftKey, setDraftKey] = useState("");
  const [activeKey, setActiveKey] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<PublicFeedbackRow[]>([]);
  const [events, setEvents] = useState<PublicAnalyticsEventRow[]>([]);
  const [analyticsNotice, setAnalyticsNotice] = useState<string | undefined>();

  useEffect(() => {
    const stored = readStoredKey();
    if (stored) {
      setDraftKey(stored);
      setActiveKey(stored);
    }
  }, []);

  const loadLists = useCallback(async (key: string) => {
    if (!key.trim()) {
      setLoadState("idle");
      setError(undefined);
      setFeedback([]);
      setEvents([]);
      setAnalyticsNotice(undefined);
      return;
    }

    setLoadState("loading");
    setError(undefined);

    try {
      const [feedbackResponse, analyticsResponse] = await Promise.all([
        fetch(`/api/feedback?limit=${OWNER_LIST_LIMIT}`, {
          headers: authHeaders(key),
          cache: "no-store",
        }),
        fetch(`/api/analytics/events?limit=${OWNER_LIST_LIMIT}`, {
          headers: authHeaders(key),
          cache: "no-store",
        }),
      ]);

      if (feedbackResponse.status === 401 || analyticsResponse.status === 401) {
        setLoadState("error");
        setError(
          "Wrong or missing admin key, or YUM4LESS_FEEDBACK_ADMIN_KEY is not set on the server.",
        );
        setFeedback([]);
        setEvents([]);
        setAnalyticsNotice(undefined);
        return;
      }

      const feedbackJson = (await feedbackResponse.json()) as {
        ok?: boolean;
        feedback?: PublicFeedbackRow[];
        error?: string;
      };
      const analyticsJson = (await analyticsResponse.json()) as {
        ok?: boolean;
        events?: PublicAnalyticsEventRow[];
        notice?: string;
        error?: string;
      };

      if (!feedbackResponse.ok || !feedbackJson.ok) {
        setLoadState("error");
        setError(feedbackJson.error ?? "Could not load feedback.");
        return;
      }

      if (!analyticsResponse.ok || !analyticsJson.ok) {
        setLoadState("error");
        setError(analyticsJson.error ?? "Could not load analytics.");
        return;
      }

      setFeedback(feedbackJson.feedback ?? []);
      setEvents(analyticsJson.events ?? []);
      setAnalyticsNotice(analyticsJson.notice);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setError("Owner lists could not be loaded. Check the network and try again.");
    }
  }, []);

  useEffect(() => {
    if (!activeKey) {
      return;
    }
    void loadLists(activeKey);
  }, [activeKey, loadLists]);

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
    setAnalyticsNotice(undefined);
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
                onClick={() => void loadLists(activeKey)}
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
              Recent rows from <code>customer_feedback</code> (up to {OWNER_LIST_LIMIT}
              ).
            </p>
            <FeedbackRecentFeed
              emptyMessage="No recent feedback."
              rows={feedback}
            />
          </section>

          <section className="panel panel-padding">
            <h2>Analytics events</h2>
            <p className="panel-copy">
              Recent Postgres rows from <code>analytics_events</code> (coarse,
              allowlisted properties only).
            </p>
            <OwnerAnalyticsFeed notice={analyticsNotice} rows={events} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
