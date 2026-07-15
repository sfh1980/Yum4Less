/**
 * Shared admin-key check for operator HTTP surfaces (feedback list, debug pipeline).
 * Send Authorization: Bearer <key> or X-Yum4Less-Admin-Key: <key>.
 *
 * Compare is plain === today (same as prior feedback helper). timingSafeEqual is a
 * separate P2 (Tier 1 S7) — not required to close Pass 2 shared-secret gap.
 */
export function isRequestAuthorizedWithAdminKey(
  request: Request,
  expectedKey: string | undefined,
): boolean {
  const key = expectedKey?.trim();
  if (!key) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token === key) {
      return true;
    }
  }

  const headerKey = request.headers.get("x-yum4less-admin-key")?.trim();
  return headerKey === key;
}
