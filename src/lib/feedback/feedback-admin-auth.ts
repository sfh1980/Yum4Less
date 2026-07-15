import { isRequestAuthorizedWithAdminKey } from "@/lib/admin-key-auth";

/**
 * Protects GET /api/feedback when feedback writes are enabled.
 * Set YUM4LESS_FEEDBACK_ADMIN_KEY and send Authorization: Bearer <key>
 * or X-Yum4Less-Admin-Key: <key>.
 */
export function isFeedbackListAuthorized(request: Request) {
  return isRequestAuthorizedWithAdminKey(
    request,
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY,
  );
}
