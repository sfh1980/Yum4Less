export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

export function isTestRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "test";
}

export function isCiRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  const ci = env.CI?.trim().toLowerCase();
  return ci === "true" || ci === "1" || env.GITHUB_ACTIONS === "true";
}

/**
 * Seed ZIP coordinates are allowed only outside production deploys, or under
 * automated CI/test runners (including Playwright against `next start`).
 */
export function allowsSeedZipGeocodingFallback(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isTestRuntime(env) || isCiRuntime(env)) {
    return true;
  }

  return !isProductionRuntime(env);
}
