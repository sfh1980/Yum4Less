/**
 * Protects GET /api/feedback when feedback writes are enabled.
 * Set YUM4LESS_FEEDBACK_ADMIN_KEY and send Authorization: Bearer <key>
 * or X-Yum4Less-Admin-Key: <key>.
 */
export function isFeedbackListAuthorized(request: Request) {
  const expectedKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY?.trim();
  if (!expectedKey) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token === expectedKey) {
      return true;
    }
  }

  const headerKey = request.headers.get("x-yum4less-admin-key")?.trim();
  return headerKey === expectedKey;
}
