/**
 * Public feedback writes stay disabled by default in production and test.
 *
 * Set YUM4LESS_FEEDBACK_ENABLED=1 to accept POST /api/feedback and persist rows
 * in Postgres. In local development, feedback auto-enables when DATABASE_URL is
 * configured so the /feedback MVP path works without extra flags.
 */
export function isFeedbackEnabled() {
  if (process.env.YUM4LESS_FEEDBACK_ENABLED === "0") {
    return false;
  }

  if (process.env.YUM4LESS_FEEDBACK_ENABLED === "1") {
    return true;
  }

  return (
    process.env.NODE_ENV === "development" && Boolean(process.env.DATABASE_URL)
  );
}
