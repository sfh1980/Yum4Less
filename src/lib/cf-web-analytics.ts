const TOKEN_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;

/**
 * Public Cloudflare Web Analytics site token.
 * Unset, blank, or malformed values add no script. This is not a secret.
 */
export function readCfWebAnalyticsToken(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const token = env.YUM4LESS_CF_WEB_ANALYTICS_TOKEN?.trim() ?? "";
  if (!TOKEN_PATTERN.test(token)) {
    return null;
  }
  return token;
}
