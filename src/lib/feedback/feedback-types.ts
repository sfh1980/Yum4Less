export const FEEDBACK_ISSUE_TYPES = [
  "wrong_price",
  "missing_item",
  "stale_ad",
  "bug",
  "general",
  "other",
] as const;

export type FeedbackIssueType = (typeof FEEDBACK_ISSUE_TYPES)[number];

export const FEEDBACK_LIMITS = {
  chainLabelMax: 60,
  productDescriptionMax: 200,
  noteMax: 500,
  recentFeedLimit: 20,
  /** Owner console / optional ?limit= on GET /api/feedback */
  ownerListDefault: 50,
  listLimitMax: 100,
} as const;

export type FeedbackInput = {
  issueType: FeedbackIssueType;
  chainLabel?: string;
  productDescription?: string;
  note?: string;
};

export type PublicFeedbackRow = {
  id: number;
  receivedAt: string;
  issueType: FeedbackIssueType;
  chainLabel: string | null;
  productDescription: string | null;
  note: string | null;
};
