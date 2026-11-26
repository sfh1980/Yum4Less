import type { WeeklyAdOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

/** Stored on weekly_ad_run_stats.miss_reason when the night found no flyer. */
export const NO_FLYER_RUN_REASON = "flyer-not-published";

/** Stored on weekly_ad_run_stats.miss_reason when tonight's ad has not started. */
export const EARLY_AD_RUN_REASON = "early-ad";

export const NO_FLYER_GRACE_NIGHTS_DEFAULT = 2;
export const EARLY_AD_SHARE_DEFAULT = 0.5;

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

export function readEarlyAdShare(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.YUM4LESS_EARLY_AD_SHARE?.trim();
  if (!raw) {
    return EARLY_AD_SHARE_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    return EARLY_AD_SHARE_DEFAULT;
  }
  return parsed;
}

/** Share of scraped offers whose valid_from is still in the future. Offers with no date are not future. */
export function futureValidFromShare(
  offers: readonly Pick<WeeklyAdOffer, "validFrom">[],
  now: Date,
): number {
  if (offers.length === 0) {
    return 0;
  }
  const nowMs = now.getTime();
  const future = offers.filter((offer) => {
    if (!offer.validFrom) {
      return false;
    }
    const starts = Date.parse(offer.validFrom);
    return Number.isFinite(starts) && starts > nowMs;
  }).length;
  return future / offers.length;
}

export function offersAreMostlyFuture(input: {
  offers: readonly Pick<WeeklyAdOffer, "validFrom">[];
  now: Date;
  share: number;
}): boolean {
  if (input.offers.length === 0) {
    return false;
  }
  return futureValidFromShare(input.offers, input.now) >= input.share;
}

/**
 * What weekly_ad_run_stats.miss_reason stores for this turn.
 * A no-flyer night wins over the early-ad mark. A real miss detail wins over both.
 */
export function chooseWeeklyAdRunMissReason(input: {
  noFlyer: boolean;
  missDetail: string | null;
  offers: readonly Pick<WeeklyAdOffer, "validFrom">[];
  now: Date;
  earlyAdShare: number;
}): string | null {
  if (input.noFlyer) {
    return NO_FLYER_RUN_REASON;
  }
  if (input.missDetail?.trim()) {
    return input.missDetail.trim();
  }
  if (
    offersAreMostlyFuture({
      offers: input.offers,
      now: input.now,
      share: input.earlyAdShare,
    })
  ) {
    return EARLY_AD_RUN_REASON;
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
