"use client";

import { useState, type FormEvent } from "react";
import {
  FEEDBACK_ISSUE_TYPES,
  type FeedbackIssueType,
} from "@/lib/feedback/feedback-types";

type FeedbackFormProps = {
  enabled: boolean;
  initialIssueType?: FeedbackIssueType;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

const ISSUE_TYPE_LABELS: Record<FeedbackIssueType, string> = {
  wrong_price: "Wrong price",
  missing_item: "Missing item",
  missing_store: "Add a grocery store",
  stale_ad: "Stale weekly ad",
  bug: "Bug or broken flow",
  general: "General product feedback",
  other: "Other",
};

export function FeedbackForm({
  enabled,
  initialIssueType = "general",
}: FeedbackFormProps) {
  const [issueType, setIssueType] = useState<FeedbackIssueType>(
    FEEDBACK_ISSUE_TYPES.includes(initialIssueType) ? initialIssueType : "general",
  );
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

  const requestingStore = issueType === "missing_store";

  return (
    <form className="form-grid feedback-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="feedback-issue-type">What are you reporting?</label>
        <select
          id="feedback-issue-type"
          name="issueType"
          onChange={(event) =>
            setIssueType(event.target.value as FeedbackIssueType)
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
          {requestingStore
            ? "Name the grocery store. A city in the note helps us find it. Skip your street address, ZIP, and contact details."
            : "For wrong prices or missing items, name the chain and what you saw — not your location."}
        </p>
      </div>

      <div className="field">
        <label htmlFor="feedback-chain-label">
          {requestingStore ? "Grocery store" : "Store chain (optional)"}
        </label>
        <input
          id="feedback-chain-label"
          maxLength={60}
          name="chainLabel"
          onChange={(event) => setChainLabel(event.target.value)}
          placeholder={requestingStore ? "Example: Harris Teeter" : "Example: Kroger"}
          type="text"
          value={chainLabel}
        />
        <p className="field-hint">
          {requestingStore
            ? "The store name is required for this request."
            : "Chain name only (e.g. Kroger, Aldi)."}
        </p>
      </div>

      {requestingStore ? null : (
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
      )}

      <div className="field">
        <label htmlFor="feedback-note">Additional details (optional)</label>
        <textarea
          id="feedback-note"
          maxLength={500}
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            requestingStore
              ? "Example: the store on the north side of town"
              : "What looked wrong or what would help us improve?"
          }
          rows={4}
          value={note}
        />
        <p className="field-hint">
          Please avoid names, phone numbers, email addresses, or other personal details.
        </p>
      </div>

      {!enabled ? (
        <p className="field-error" role="status">
          Feedback is temporarily unavailable. Please try again later.
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
