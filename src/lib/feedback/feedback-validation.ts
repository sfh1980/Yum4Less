import { clampTrimmedString } from "@/lib/api-request";
import {
  FEEDBACK_ISSUE_TYPES,
  FEEDBACK_LIMITS,
  type FeedbackInput,
  type FeedbackIssueType,
} from "@/lib/feedback/feedback-types";

const ISSUE_TYPE_SET = new Set<string>(FEEDBACK_ISSUE_TYPES);

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "address",
  "home",
  "ingredient",
  "internalStoreId",
  "latitude",
  "longitude",
  "mealTitle",
  "price",
  "providerStoreId",
  "storeId",
  "storeName",
  "userAgent",
  "zip",
  "zipCode",
]);
const FORBIDDEN_PAYLOAD_KEYS_NORMALIZED = new Set(
  [...FORBIDDEN_PAYLOAD_KEYS].map((key) => key.toLowerCase()),
);

export function validateFeedbackPayload(
  body: unknown,
): { ok: true; feedback: FeedbackInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Feedback payload is invalid." };
  }

  const record = body as Record<string, unknown>;
  const forbiddenKey = findForbiddenPayloadKey(record);
  if (forbiddenKey) {
    return { ok: false, error: "Feedback payload includes disallowed data." };
  }

  if (typeof record.issueType !== "string" || !ISSUE_TYPE_SET.has(record.issueType)) {
    return { ok: false, error: "Feedback issue type is not supported." };
  }

  const chainLabel = clampTrimmedString(record.chainLabel, {
    max: FEEDBACK_LIMITS.chainLabelMax,
  });
  const productDescription = clampTrimmedString(record.productDescription, {
    max: FEEDBACK_LIMITS.productDescriptionMax,
  });
  const note = clampTrimmedString(record.note, { max: FEEDBACK_LIMITS.noteMax });

  if (record.chainLabel !== undefined && chainLabel === undefined) {
    return { ok: false, error: "Chain label is invalid or too long." };
  }

  if (record.productDescription !== undefined && productDescription === undefined) {
    return { ok: false, error: "Product description is invalid or too long." };
  }

  if (record.note !== undefined && note === undefined) {
    return { ok: false, error: "Feedback note is invalid or too long." };
  }

  const issueType = record.issueType as FeedbackIssueType;
  if (
    (issueType === "wrong_price" || issueType === "missing_item" || issueType === "stale_ad") &&
    !chainLabel &&
    !productDescription
  ) {
    return {
      ok: false,
      error: "Wrong-price and store-item reports need a chain label or product description.",
    };
  }

  return {
    ok: true,
    feedback: {
      issueType,
      chainLabel,
      productDescription,
      note,
    },
  };
}

function findForbiddenPayloadKey(record: Record<string, unknown>) {
  for (const key of Object.keys(record)) {
    if (
      FORBIDDEN_PAYLOAD_KEYS.has(key) ||
      FORBIDDEN_PAYLOAD_KEYS_NORMALIZED.has(key.toLowerCase())
    ) {
      return key;
    }
  }

  return undefined;
}
