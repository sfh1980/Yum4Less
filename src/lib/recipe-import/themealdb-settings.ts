/** Per-request limit for the sale-driven TheMealDB import. */
export const THEMEALDB_TIMEOUT_MS_ENV = "YUM4LESS_THEMEALDB_TIMEOUT_MS";

/** One hung request should stop well before the import's usual half-minute. */
export const THEMEALDB_TIMEOUT_MS_DEFAULT = 15_000;

/**
 * Milliseconds before one TheMealDB request is aborted.
 * Unset or unusable values use the default.
 */
export function readThemealdbTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[THEMEALDB_TIMEOUT_MS_ENV]?.trim();
  if (!raw) {
    return THEMEALDB_TIMEOUT_MS_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1_000) {
    return THEMEALDB_TIMEOUT_MS_DEFAULT;
  }
  return parsed;
}

/** Consecutive mornings of a missed recipe import before the note says Needs you. */
export const RECIPE_IMPORT_NEEDS_YOU_MORNINGS_ENV = "YUM4LESS_RECIPE_IMPORT_NEEDS_YOU_MORNINGS";

export const RECIPE_IMPORT_NEEDS_YOU_MORNINGS_DEFAULT = 3;

/**
 * How many mornings in a row a missed import may stay informational.
 * Unset or unusable values use the default.
 */
export function readRecipeImportNeedsYouMornings(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[RECIPE_IMPORT_NEEDS_YOU_MORNINGS_ENV]?.trim();
  if (!raw) {
    return RECIPE_IMPORT_NEEDS_YOU_MORNINGS_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return RECIPE_IMPORT_NEEDS_YOU_MORNINGS_DEFAULT;
  }
  return parsed;
}
