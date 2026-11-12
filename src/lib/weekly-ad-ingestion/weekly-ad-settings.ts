import { readWeeklyAdBackoffMs, readWeeklyAdHttpRetries } from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";
import {
  readPublixCardMaxWaitMs,
  readPublixCardScrollViewports,
  readPublixFeedMinShare,
  readPublixHarvestMinShare,
  readPublixMergeSectionCards,
  readPublixPrintedTotalIsFloor,
  readPublixThinMinCards,
} from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";
import {
  readWeeklyAdRetryMaxPerDay,
  WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT,
} from "@/lib/weekly-ad-ingestion/weekly-ad-retry";

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

function weeklyAdFlag(raw: string | undefined): string {
  return raw?.trim() === "1" ? "1" : "0";
}

function weeklyAdRetryMaxForLog(env: NodeJS.ProcessEnv): number {
  try {
    return readWeeklyAdRetryMaxPerDay(env);
  } catch {
    return WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT;
  }
}

/**
 * Effective weekly-ad and Publix settings. Names are a fixed allow-list.
 * Values are the numbers and flags the run will use. Secrets are not read.
 */
export function formatWeeklyAdSettingsLine(env: NodeJS.ProcessEnv = process.env): string {
  const pairs: Array<[string, string]> = [
    ["YUM4LESS_WEEKLY_AD_FIXTURE", weeklyAdFlag(env.YUM4LESS_WEEKLY_AD_FIXTURE)],
    ["YUM4LESS_WEEKLY_AD_NO_BROWSER", weeklyAdFlag(env.YUM4LESS_WEEKLY_AD_NO_BROWSER)],
    ["YUM4LESS_WEEKLY_AD_CAPTURE", weeklyAdFlag(env.YUM4LESS_WEEKLY_AD_CAPTURE)],
    ["YUM4LESS_WEEKLY_AD_HTTP_RETRIES", String(readWeeklyAdHttpRetries(env))],
    ["YUM4LESS_WEEKLY_AD_BACKOFF_MS", String(readWeeklyAdBackoffMs(env))],
    ["YUM4LESS_WEEKLY_AD_MAX_UNVERIFIED_DAYS", String(readWeeklyAdMaxUnverifiedDays(env))],
    ["YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY", String(weeklyAdRetryMaxForLog(env))],
    ["YUM4LESS_PUBLIX_CARD_MAX_WAIT_MS", String(readPublixCardMaxWaitMs(env))],
    ["YUM4LESS_PUBLIX_CARD_SCROLL_VIEWPORTS", String(readPublixCardScrollViewports(env))],
    ["YUM4LESS_PUBLIX_THIN_MIN_CARDS", String(readPublixThinMinCards(env))],
    ["YUM4LESS_PUBLIX_PRINTED_TOTAL_IS_FLOOR", readPublixPrintedTotalIsFloor(env) ? "1" : "0"],
    ["YUM4LESS_PUBLIX_MERGE_SECTION_CARDS", readPublixMergeSectionCards(env) ? "1" : "0"],
    ["YUM4LESS_PUBLIX_HARVEST_MIN_SHARE", String(readPublixHarvestMinShare(env))],
    ["YUM4LESS_PUBLIX_FEED_MIN_SHARE", String(readPublixFeedMinShare(env))],
  ];
  return `[nightly] ${pairs.map(([name, value]) => `${name}=${value}`).join(" ")}`;
}
