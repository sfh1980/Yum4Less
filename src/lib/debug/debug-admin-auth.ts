import { isRequestAuthorizedWithAdminKey } from "@/lib/admin-key-auth";

/**
 * Protects GET /api/debug/pipeline when debug routes are enabled.
 * Set YUM4LESS_DEBUG_ADMIN_KEY and send Authorization: Bearer <key>
 * or X-Yum4Less-Admin-Key: <key>.
 *
 * Production still always 404s via isDebugRoutesEnabled(); this key is required
 * in non-production when YUM4LESS_DEBUG_ROUTES_ENABLED=1.
 */
export function isDebugPipelineAuthorized(request: Request) {
  return isRequestAuthorizedWithAdminKey(
    request,
    process.env.YUM4LESS_DEBUG_ADMIN_KEY,
  );
}
