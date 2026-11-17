/**
 * Calendar zone for weekly-ad run dates, the daytime retry day, the weekly-ad
 * browser, and the morning note.
 *
 * YUM4LESS_BUSINESS_TIME_ZONE is required. There is no silent default.
 * Unset or invalid throws one error that names the setting. Ingest scripts
 * and the morning report call this at start-up and stop.
 *
 * Container TZ is separate. It decides when cron fires. This setting decides
 * which calendar day a timestamp belongs to.
 */

export const BUSINESS_TIME_ZONE_ENV = "YUM4LESS_BUSINESS_TIME_ZONE";

export function readBusinessTimeZone(env: NodeJS.ProcessEnv = process.env): string {
  const zone = env[BUSINESS_TIME_ZONE_ENV]?.trim() ?? "";
  if (!zone) {
    throw new Error(
      "YUM4LESS_BUSINESS_TIME_ZONE is not set. Set it to an IANA time zone before starting ingest or the morning report.",
    );
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    throw new Error(
      `YUM4LESS_BUSINESS_TIME_ZONE is not a real IANA time zone (${zone}).`,
    );
  }

  return zone;
}

/** Calendar date YYYY-MM-DD in the given IANA zone. */
export function formatBusinessCalendarDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatBusinessWeekday(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(now);
}
