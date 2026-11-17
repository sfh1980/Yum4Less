import { timingSafeEqual } from "node:crypto";

/**
 * Shared admin-key check for operator HTTP surfaces (feedback list, owner
 * routes, debug pipeline). Send Authorization: Bearer <key> or
 * X-Yum4Less-Admin-Key: <key>.
 *
 * Comparison uses timingSafeEqual. A different length returns false without
 * calling it (timingSafeEqual throws when the buffers differ in length).
 * A missing or empty configured key returns false before any compare.
 */
export function adminKeysMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
}

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
    if (adminKeysMatch(token, key)) {
      return true;
    }
  }

  const headerKey = request.headers.get("x-yum4less-admin-key")?.trim();
  if (!headerKey) {
    return false;
  }

  return adminKeysMatch(headerKey, key);
}
