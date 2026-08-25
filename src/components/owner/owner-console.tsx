"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { FeedbackRecentFeed } from "@/components/feedback/feedback-recent-feed";
import { OwnerAnalyticsFeed } from "@/components/owner/owner-analytics-feed";
import {
  DEFAULT_OWNER_CONSOLE_TAB,
  OWNER_CONSOLE_TABS,
  type OwnerConsoleTab,
} from "@/components/owner/owner-console-tab";
import type { PublicAnalyticsEventRow } from "@/lib/analytics/analytics-repository";
import {
  FEEDBACK_LIMITS,
  type PublicFeedbackRow,
} from "@/lib/feedback/feedback-types";
import {
  INGREDIENT_CATEGORIES,
  isIngredientCategory,
} from "@/lib/ingredient-category";
import {
  isCanonicalIngredientId,
  slugifyIngredientId,
  titleCaseIngredientName,
} from "@/lib/ingredient-id";

type PublicIngredientReviewRow = {
  id: number;
  normalizedLabel: string;
  rawProductName: string;
  chain: string | null;
  seenAt: string;
  suggestedIngredientId: string | null;
  suggestedName: string | null;
  suggestedCategory: string | null;
};

type ReviewDraft = {
  ingredientId: string;
  ingredientName: string;
  category: string;
};

const OWNER_ADMIN_KEY_STORAGE = "yum4less.owner-admin-key.v1";
const OWNER_PAGE_SIZE = FEEDBACK_LIMITS.ownerListDefault;
const CATEGORY_LABELS: Record<(typeof INGREDIENT_CATEGORIES)[number], string> = {
  protein: "Protein",
  produce: "Produce",
  pantry: "Pantry",
  dairy: "Dairy",
  seasoning: "Seasoning",
  baking: "Baking",
  frozen: "Frozen",
};

function buildReviewDraft(row: PublicIngredientReviewRow): ReviewDraft {
  return {
    ingredientId:
      row.suggestedIngredientId ?? slugifyIngredientId(row.normalizedLabel),
    ingredientName:
      row.suggestedName ?? titleCaseIngredientName(row.normalizedLabel),
    category: row.suggestedCategory ?? "",
  };
}

function validateYesDraft(draft: ReviewDraft): string | undefined {
  const ingredientId = slugifyIngredientId(draft.ingredientId);
  if (!isCanonicalIngredientId(ingredientId)) {
    return "Canonical food id must be lowercase kebab-case (letters, numbers, hyphens), 2-56 characters. Example: imitation-crab.";
  }
  if (!draft.ingredientName.trim()) {
    return "Enter a short shopper-facing name. Example: Imitation crab. Skip brand, size, and pack counts.";
  }
  if (!isIngredientCategory(draft.category)) {
    return "Pick a category. New foods need one; if this id already exists it is ignored.";
  }
  return undefined;
}

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
  const [loadingMore, setLoadingMore] = useState<
    "feedback" | "analytics" | "reviews" | null
  >(null);
  const [error, setError] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<PublicFeedbackRow[]>([]);
  const [events, setEvents] = useState<PublicAnalyticsEventRow[]>([]);
  const [reviews, setReviews] = useState<PublicIngredientReviewRow[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, ReviewDraft>>(
    {},
  );
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | undefined>();
  const [feedbackHasMore, setFeedbackHasMore] = useState(false);
  const [analyticsHasMore, setAnalyticsHasMore] = useState(false);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [feedbackNextOffset, setFeedbackNextOffset] = useState(0);
  const [analyticsNextOffset, setAnalyticsNextOffset] = useState(0);
  const [reviewsNextOffset, setReviewsNextOffset] = useState(0);
  const [analyticsNotice, setAnalyticsNotice] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<OwnerConsoleTab>(
    DEFAULT_OWNER_CONSOLE_TAB,
  );
  const tabButtonRefs = useRef<Partial<Record<OwnerConsoleTab, HTMLButtonElement | null>>>(
    {},
  );

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
        reviewsOffset: number;
        which?: "both" | "feedback" | "analytics" | "reviews";
      },
    ) => {
      if (!key.trim()) {
        setLoadState("idle");
        setError(undefined);
        setFeedback([]);
        setEvents([]);
        setReviews([]);
        setReviewDrafts({});
        setFeedbackHasMore(false);
        setAnalyticsHasMore(false);
        setReviewsHasMore(false);
        setFeedbackNextOffset(0);
        setAnalyticsNextOffset(0);
        setReviewsNextOffset(0);
        setAnalyticsNotice(undefined);
        setReviewNotice(undefined);
        return;
      }

      const which = options.which ?? "both";
      if (options.reset) {
        setLoadState("loading");
      } else if (which === "feedback") {
        setLoadingMore("feedback");
      } else if (which === "analytics") {
        setLoadingMore("analytics");
      } else if (which === "reviews") {
        setLoadingMore("reviews");
      }
      setError(undefined);

      try {
        const fetches: Promise<Response>[] = [];
        const fetchKinds: Array<"feedback" | "analytics" | "reviews"> = [];

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
        if (which === "both" || which === "reviews") {
          fetchKinds.push("reviews");
          fetches.push(
            fetch(
              `/api/owner/ingredient-reviews?limit=${OWNER_PAGE_SIZE}&offset=${options.reviewsOffset}`,
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
          setReviews([]);
          setReviewDrafts({});
          setFeedbackHasMore(false);
          setAnalyticsHasMore(false);
          setReviewsHasMore(false);
          setFeedbackNextOffset(0);
          setAnalyticsNextOffset(0);
          setReviewsNextOffset(0);
          setAnalyticsNotice(undefined);
          setReviewNotice(undefined);
          return;
        }

        for (let index = 0; index < responses.length; index += 1) {
          const kind = fetchKinds[index]!;
          const response = responses[index]!;
          const json = (await response.json()) as {
            ok?: boolean;
            feedback?: PublicFeedbackRow[];
            events?: PublicAnalyticsEventRow[];
            reviews?: PublicIngredientReviewRow[];
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
                  : kind === "analytics"
                    ? "Could not load analytics."
                    : "Could not load ingredient reviews."),
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
          } else if (kind === "analytics") {
            const page = json.events ?? [];
            setEvents((current) =>
              options.reset ? page : mergeById(current, page),
            );
            setAnalyticsHasMore(Boolean(json.hasMore));
            setAnalyticsNextOffset(pageOffset + page.length);
            if (options.reset || json.notice) {
              setAnalyticsNotice(json.notice);
            }
          } else {
            const page = json.reviews ?? [];
            setReviews((current) =>
              options.reset ? page : mergeById(current, page),
            );
            setReviewsHasMore(Boolean(json.hasMore));
            setReviewsNextOffset(pageOffset + page.length);
            setReviewDrafts((current) => {
              const next = options.reset ? {} : { ...current };
              for (const row of page) {
                if (next[row.id] === undefined) {
                  next[row.id] = buildReviewDraft(row);
                }
              }
              return next;
            });
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
      reviewsOffset: 0,
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
    setReviews([]);
    setReviewDrafts({});
    setFeedbackHasMore(false);
    setAnalyticsHasMore(false);
    setReviewsHasMore(false);
    setFeedbackNextOffset(0);
    setAnalyticsNextOffset(0);
    setReviewsNextOffset(0);
    setAnalyticsNotice(undefined);
    setReviewNotice(undefined);
    setActiveTab(DEFAULT_OWNER_CONSOLE_TAB);
  }

  function handleRefresh() {
    if (!activeKey) {
      return;
    }
    void loadPage(activeKey, {
      reset: true,
      feedbackOffset: 0,
      analyticsOffset: 0,
      reviewsOffset: 0,
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
      reviewsOffset: reviewsNextOffset,
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
      reviewsOffset: reviewsNextOffset,
      which: "analytics",
    });
  }

  function handleLoadMoreReviews() {
    if (!activeKey || !reviewsHasMore) {
      return;
    }
    void loadPage(activeKey, {
      reset: false,
      feedbackOffset: feedbackNextOffset,
      analyticsOffset: analyticsNextOffset,
      reviewsOffset: reviewsNextOffset,
      which: "reviews",
    });
  }

  async function handleReviewDecision(
    row: PublicIngredientReviewRow,
    decision: "yes" | "no",
  ) {
    if (!activeKey) {
      return;
    }
    const draft = reviewDrafts[row.id] ?? buildReviewDraft(row);
    if (decision === "yes") {
      const draftError = validateYesDraft(draft);
      if (draftError) {
        setReviewNotice(draftError);
        return;
      }
    }
    setReviewingId(row.id);
    setReviewNotice(undefined);
    try {
      const ingredientId = slugifyIngredientId(draft.ingredientId);
      const response = await fetch("/api/owner/ingredient-reviews", {
        method: "POST",
        headers: {
          ...authHeaders(activeKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          normalizedLabel: row.normalizedLabel,
          decision,
          ingredientId: decision === "yes" ? ingredientId : undefined,
          ingredientName:
            decision === "yes" ? draft.ingredientName.trim() : undefined,
          category: decision === "yes" ? draft.category : undefined,
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        ingredientId?: string;
      };
      if (response.status === 401) {
        setLoadState("error");
        setError(
          "Wrong or missing admin key, or YUM4LESS_FEEDBACK_ADMIN_KEY is not set on the server.",
        );
        return;
      }
      if (!response.ok || !json.ok) {
        setReviewNotice(json.error ?? "That flyer line could not be reviewed.");
        return;
      }
      setReviews((current) => current.filter((item) => item.id !== row.id));
      setReviewNotice(
        decision === "yes"
          ? `Saved as ${json.ingredientId ?? slugifyIngredientId(draft.ingredientId)}. Next ingest can price it.`
          : "Remembered as skip. That line will not become a food.",
      );
    } catch {
      setReviewNotice("Ingredient review could not be saved. Check the network and try again.");
    } finally {
      setReviewingId(null);
    }
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: OwnerConsoleTab,
  ) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();
    const index = OWNER_CONSOLE_TABS.findIndex((tab) => tab.id === currentTab);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next =
      OWNER_CONSOLE_TABS[
        (index + delta + OWNER_CONSOLE_TABS.length) % OWNER_CONSOLE_TABS.length
      ]!;
    setActiveTab(next.id);
    tabButtonRefs.current[next.id]?.focus();
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
          <div
            className="owner-tablist"
            role="tablist"
            aria-label="Owner console"
          >
            {OWNER_CONSOLE_TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  aria-controls={`owner-panel-${tab.id}`}
                  aria-selected={selected}
                  className={`owner-tab${selected ? " owner-tab--selected" : ""}`}
                  id={`owner-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  ref={(element) => {
                    tabButtonRefs.current[tab.id] = element;
                  }}
                  role="tab"
                  tabIndex={selected ? 0 : -1}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "reviews" ? (
          <section
            aria-labelledby="owner-tab-reviews"
            className="panel panel-padding"
            id="owner-panel-reviews"
            role="tabpanel"
          >
            <h2>Ingredient review</h2>
            <p className="panel-copy">
              Unclear weekly-ad lines wait here. Yes attaches the flyer wording
              to a food id (creates the id when it is new). No remembers a skip.
              Shoppers never see these until the next ingest prices them. Pantry
              leftovers stay 1-4 items.
            </p>
            <div className="owner-review-help">
              <p className="owner-review-help-title">How to create or reuse a food id</p>
              <ol>
                <li>
                  Prefer an existing id when this is the same food we already
                  track. Examples: <code>chicken-thighs</code>,{" "}
                  <code>green-beans</code>, <code>heavy-cream</code>. Name and
                  category are ignored if that id already exists.
                </li>
                <li>
                  Create a new id only for a real grocery ingredient we do not
                  have yet. Example: flyer Imitation Crab Meat → id{" "}
                  <code>imitation-crab</code>, name Imitation crab, category
                  Protein.
                </li>
                <li>
                  Id format: lowercase kebab-case, letters, numbers, and hyphens
                  only, 2-56 characters. Yes will format spaces and capitals
                  (so Imitation Crab becomes <code>imitation-crab</code>). Do
                  not put brands, sizes, or pack counts in the id (not{" "}
                  <code>yoplait-strawberry-6oz</code>).
                </li>
                <li>
                  Shopper-facing name: short title case, no flyer fluff. Category
                  must be one of protein, produce, pantry, dairy, seasoning,
                  baking, or frozen.
                </li>
              </ol>
            </div>
            {reviewNotice ? (
              <p className="panel-copy" role="status">
                {reviewNotice}
              </p>
            ) : null}
            {reviews.length === 0 ? (
              <p className="panel-copy">No flyer lines waiting for review.</p>
            ) : (
              <ul className="owner-review-list">
                {reviews.map((row) => {
                  const draft = reviewDrafts[row.id] ?? buildReviewDraft(row);
                  const formattedId = slugifyIngredientId(draft.ingredientId);
                  return (
                  <li className="owner-review-row" key={row.id}>
                    <p className="owner-review-title">{row.rawProductName}</p>
                    <p className="panel-copy">
                      {row.chain ?? "unknown chain"} · {row.normalizedLabel}
                      {row.suggestedIngredientId
                        ? ` · suggested ${row.suggestedIngredientId}`
                        : " · no existing suggestion — fill the fields to create one"}
                    </p>
                    <div className="owner-review-fields">
                    <label className="field" htmlFor={`owner-review-id-${row.id}`}>
                      <span className="field-label">Canonical food id</span>
                      <input
                        aria-describedby={`owner-review-id-${row.id}-hint`}
                        id={`owner-review-id-${row.id}`}
                        onChange={(event) =>
                          setReviewDrafts((current) => ({
                            ...current,
                            [row.id]: {
                              ...draft,
                              ingredientId: event.target.value,
                            },
                          }))
                        }
                        spellCheck={false}
                        value={draft.ingredientId}
                      />
                      <p className="field-hint" id={`owner-review-id-${row.id}-hint`}>
                        {formattedId && formattedId !== draft.ingredientId.trim()
                          ? `Saves as ${formattedId}.`
                          : "Lowercase kebab-case. Example: imitation-crab."}
                      </p>
                    </label>
                    <label className="field" htmlFor={`owner-review-name-${row.id}`}>
                      <span className="field-label">Shopper-facing name</span>
                      <input
                        id={`owner-review-name-${row.id}`}
                        onChange={(event) =>
                          setReviewDrafts((current) => ({
                            ...current,
                            [row.id]: {
                              ...draft,
                              ingredientName: event.target.value,
                            },
                          }))
                        }
                        value={draft.ingredientName}
                      />
                      <p className="field-hint">
                        Short title case. Example: Imitation crab.
                      </p>
                    </label>
                    <label className="field" htmlFor={`owner-review-category-${row.id}`}>
                      <span className="field-label">Category</span>
                      <select
                        id={`owner-review-category-${row.id}`}
                        onChange={(event) =>
                          setReviewDrafts((current) => ({
                            ...current,
                            [row.id]: {
                              ...draft,
                              category: event.target.value,
                            },
                          }))
                        }
                        value={draft.category}
                      >
                        <option value="">Choose category</option>
                        {INGREDIENT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </label>
                    </div>
                    <div className="action-row">
                      <button
                        className="primary-button"
                        disabled={reviewingId === row.id}
                        onClick={() => void handleReviewDecision(row, "yes")}
                        type="button"
                      >
                        Yes
                      </button>
                      <button
                        className="secondary-button"
                        disabled={reviewingId === row.id}
                        onClick={() => void handleReviewDecision(row, "no")}
                        type="button"
                      >
                        No
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
            {reviewsHasMore ? (
              <div className="action-row owner-load-more-row">
                <button
                  className="secondary-button"
                  disabled={loadingMore === "reviews"}
                  onClick={handleLoadMoreReviews}
                  type="button"
                >
                  {loadingMore === "reviews"
                    ? "Loading…"
                    : `Show next ${OWNER_PAGE_SIZE} reviews`}
                </button>
              </div>
            ) : null}
          </section>
          ) : null}

          {activeTab === "feedback" ? (
          <section
            aria-labelledby="owner-tab-feedback"
            className="panel panel-padding"
            id="owner-panel-feedback"
            role="tabpanel"
          >
            <h2>User feedback</h2>
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
          ) : null}

          {activeTab === "analytics" ? (
          <section
            aria-labelledby="owner-tab-analytics"
            className="panel panel-padding"
            id="owner-panel-analytics"
            role="tabpanel"
          >
            <h2>Analytics</h2>
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
