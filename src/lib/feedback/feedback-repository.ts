import { getDbPool } from "@/lib/db";
import {
  FEEDBACK_LIMITS,
  type FeedbackInput,
  type PublicFeedbackRow,
} from "@/lib/feedback/feedback-types";

export async function insertCustomerFeedback(feedback: FeedbackInput) {
  const pool = getDbPool();
  const result = await pool.query<{ id: number }>(
    `
      insert into customer_feedback (
        issue_type,
        chain_label,
        product_description,
        note,
        app_env
      )
      values ($1, $2, $3, $4, $5)
      returning id
    `,
    [
      feedback.issueType,
      feedback.chainLabel ?? null,
      feedback.productDescription ?? null,
      feedback.note ?? null,
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    ],
  );

  const id = result.rows[0]?.id;
  return id === undefined ? undefined : Number(id);
}

export async function listRecentCustomerFeedback(
  limit = FEEDBACK_LIMITS.recentFeedLimit,
): Promise<PublicFeedbackRow[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    id: number;
    received_at: Date;
    issue_type: PublicFeedbackRow["issueType"];
    chain_label: string | null;
    product_description: string | null;
    note: string | null;
  }>(
    `
      select
        id,
        received_at,
        issue_type,
        chain_label,
        product_description,
        note
      from customer_feedback
      order by received_at desc
      limit $1
    `,
    [limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    receivedAt: row.received_at.toISOString(),
    issueType: row.issue_type,
    chainLabel: row.chain_label,
    productDescription: row.product_description,
    note: row.note,
  }));
}
