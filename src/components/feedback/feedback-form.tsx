"use client";

import { useState, type FormEvent } from "react";
import { FEEDBACK_ISSUE_TYPES } from "@/lib/feedback/feedback-types";

type FeedbackFormProps = {
  enabled: boolean;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

const ISSUE_TYPE_LABELS: Record<(typeof FEEDBACK_ISSUE_TYPES)[number], string> = {
  wrong_price: "Wrong price",
  missing_item: "Missing item",
  stale_ad: "Stale weekly ad",
  bug: "Bug or broken flow",
  general: "General product feedback",
  other: "Other",
};

export function FeedbackForm({ enabled }: FeedbackFormProps) {
  const [issueType, setIssueType] =
    useState<(typeof FEEDBACK_ISSUE_TYPES)[number]>("general");
  const [chainLabel, setChainLabel] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!enabled) {
      setSubmitState({
        status: "error",
        message: "Feedback is not enabled on this server yet.",
      });
      return;
    }

    setSubmitState({ status: "submitting" });

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueType,
          chainLabel: chainLabel.trim() || undefined,
          productDescription: productDescription.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setSubmitState({
          status: "error",
          message: payload.error ?? "Feedback could not be sent. Please try again.",
        });
        return;
      }

      setChainLabel("");
      setProductDescription("");
      setNote("");
      setIssueType("general");
      setSubmitState({ status: "success" });
    } catch {
      setSubmitState({
        status: "error",
        message: "Feedback could not be sent. Please try again.",
      });
    }
  }

  return (
    <form className="form-grid feedback-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="feedback-issue-type">What are you reporting?</label>
        <select
          id="feedback-issue-type"
          name="issueType"
          onChange={(event) =>
            setIssueType(event.target.value as (typeof FEEDBACK_ISSUE_TYPES)[number])
          }
          value={issueType}
        >
          {FEEDBACK_ISSUE_TYPES.map((value) => (
            <option key={value} value={value}>
              {ISSUE_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="field-hint">
          For wrong prices or missing items, include the store chain and what you saw.
          Do not include your ZIP code, address, or exact location.
        </p>
      </div>

      <div className="field">
        <label htmlFor="feedback-chain-label">Store chain (optional)</label>
        <input
          id="feedback-chain-label"
          maxLength={60}
          name="chainLabel"
          onChange={(event) => setChainLabel(event.target.value)}
          placeholder="Example: Kroger"
          type="text"
          value={chainLabel}
        />
        <p className="field-hint">Use the chain name only — not an internal store ID.</p>
      </div>

      <div className="field">
        <label htmlFor="feedback-product-description">Ingredient or product (optional)</label>
        <input
          id="feedback-product-description"
          maxLength={200}
          name="productDescription"
          onChange={(event) => setProductDescription(event.target.value)}
          placeholder="Example: boneless chicken breast"
          type="text"
          value={productDescription}
        />
      </div>

      <div className="field">
        <label htmlFor="feedback-note">Additional details (optional)</label>
        <textarea
          id="feedback-note"
          maxLength={500}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="What looked wrong or what would help us improve?"
          rows={4}
          value={note}
        />
        <p className="field-hint">
          Please avoid names, phone numbers, email addresses, or other personal details.
        </p>
      </div>

      {!enabled ? (
        <p className="field-error" role="status">
          Feedback storage is disabled on this server. Set YUM4LESS_FEEDBACK_ENABLED=1 in
          .env.local (with DATABASE_URL and the customer_feedback migration applied), then
          restart npm run dev.
        </p>
      ) : null}

      {submitState.status === "success" ? (
        <p className="feedback-success" role="status">
          Thanks — your feedback was saved anonymously.
        </p>
      ) : null}

      {submitState.status === "error" ? (
        <p className="field-error" role="alert">
          {submitState.message}
        </p>
      ) : null}

      <button
        className="primary-button"
        disabled={!enabled || submitState.status === "submitting"}
        type="submit"
      >
        {submitState.status === "submitting" ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
