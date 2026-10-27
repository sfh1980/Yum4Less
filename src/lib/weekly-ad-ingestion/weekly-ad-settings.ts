/** How long an unchanged flyer may keep refreshing last_verified_at. */
export const WEEKLY_AD_MAX_UNVERIFIED_DAYS_ENV =
  "YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS";

export const WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT = 8;

/**
 * Days since observed_at that an unchanged flyer may still refresh.
 * Unset or unusable values use the default so a stuck source cannot be
 * refreshed forever by leaving the setting blank.
 */
export function readWeeklyAdMaxUnverifiedDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[WEEKLY_AD_MAX_UNVERIFIED_DAYS_ENV]?.trim();
  if (!raw) {
    return WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return WEEKLY_AD_MAX_UNVERIFIED_DAYS_DEFAULT;
  }
  return parsed;
}
