/** Stored on weekly_ad_run_stats.miss_reason when the night found no flyer. */
export const NO_FLYER_RUN_REASON = "flyer-not-published";

export const NO_FLYER_GRACE_NIGHTS_DEFAULT = 2;

export function readNoFlyerGraceNights(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.YUM4LESS_NO_FLYER_GRACE_NIGHTS?.trim();
  if (!raw) {
    return NO_FLYER_GRACE_NIGHTS_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return NO_FLYER_GRACE_NIGHTS_DEFAULT;
  }
  return parsed;
}

/**
 * What weekly_ad_run_stats.miss_reason stores for this turn.
 * A no-flyer night wins. A real miss detail is stored as written. Anything else stays empty.
 */
export function chooseWeeklyAdRunMissReason(input: {
  noFlyer: boolean;
  missDetail: string | null;
}): string | null {
  if (input.noFlyer) {
    return NO_FLYER_RUN_REASON;
  }
  if (input.missDetail?.trim()) {
    return input.missDetail.trim();
  }
  return null;
}

export function previousCalendarDate(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(utc - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Consecutive nights ending on endDate whose miss_reason is flyer-not-published.
 * A missing night or any other reason ends the streak.
 */
export function countConsecutiveNoFlyerNights(
  rowsNewestFirst: readonly { runDate: string; missReason: string | null }[],
  endDate: string,
): number {
  const byDate = new Map(rowsNewestFirst.map((row) => [row.runDate, row.missReason]));
  let cursor: string | null = endDate;
  let count = 0;
  while (cursor) {
    if (!byDate.has(cursor)) {
      return count;
    }
    if (byDate.get(cursor) !== NO_FLYER_RUN_REASON) {
      return count;
    }
    count += 1;
    cursor = previousCalendarDate(cursor);
  }
  return count;
}
