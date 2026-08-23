import { isRequestAuthorizedWithAdminKey } from "@/lib/admin-key-auth";

/**
 * Protects owner/admin GET lists (feedback, analytics, ingredient reviews)
 * when YUM4LESS_FEEDBACK_ADMIN_KEY is set.
 * Send Authorization: Bearer <key> or X-Yum4Less-Admin-Key: <key>.
 */
export function isFeedbackListAuthorized(request: Request) {
  return isRequestAuthorizedWithAdminKey(
    request,
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY,
  );
}
