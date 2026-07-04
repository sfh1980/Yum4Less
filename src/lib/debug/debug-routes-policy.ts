/**
 * Debug HTTP routes expose pipeline internals and must stay off in production
 * and behind an explicit operator flag in non-production deploys (homelab may
 * not set NODE_ENV=production correctly).
 */
export function isDebugRoutesEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.YUM4LESS_DEBUG_ROUTES_ENABLED === "1";
}
