import { isRequestAuthorizedWithAdminKey } from "@/lib/admin-key-auth";

/**
 * Protects owner/admin lists (feedback, analytics, ingredient reviews, /api/owner/*)
 * when YUM4LESS_FEEDBACK_ADMIN_KEY is set.
 * Send Authorization: Bearer <key> or X-Yum4Less-Admin-Key: <key>.
 * The compare itself is constant-time in isRequestAuthorizedWithAdminKey.
 */
export function isFeedbackListAuthorized(request: Request) {
  return isRequestAuthorizedWithAdminKey(
    request,
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY,
  );
}
