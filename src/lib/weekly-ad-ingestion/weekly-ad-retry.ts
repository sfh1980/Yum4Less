/**
 * Daytime retry for chains that have no fresh ranked rows.
 * Installed in docker/ingest/crontab. One chain per run. Does not write an ingest_jobs row.
 * A run that cannot take the weekly-ad lock skips and does not count an attempt.
 *
 * Container TZ is America/New_York. This does not replace the 3:00am run.
 *
 * 0 6-12 * * * root . /etc/yum4less/ingest.env && cd /app && /usr/local/bin/npm run ingest:weekly-ads:retry >> /var/log/yum4less/ingest.log 2>&1
 *
 * YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY defaults to 6 (the noon slot can still
 * pick a different chain after one chain has used its six).
 */

export const WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT = 6;
/** Stop thin retries after this many identical thin results in one New York day. */
export const WEEKLY_AD_THIN_IDENTICAL_LIMIT = 2;

export type WeeklyAdRetryCandidate = {
  chainId: string;
  freshCount: number;
  /** Latest parse was thin. Retried even when fresh rows remain. */
  thinPage?: boolean;
};

export type WeeklyAdRetryThinStamp = {
  /** `${seenCards}:${parsedOffers}` from the last thin run. */
  signature: string;
  /** How many thin runs in a row shared that signature. */
  identical: number;
};

export type WeeklyAdRetryState = {
  date: string;
  counts: Record<string, number>;
  thinStamps: Record<string, WeeklyAdRetryThinStamp>;
};

export function readWeeklyAdRetryMaxPerDay(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const raw = env.YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY?.trim();
  if (!raw) {
    return WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
    throw new Error(
      "YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY must be a whole number from 1 to 24.",
    );
  }
  return parsed;
}

/** New York calendar date, matching the morning note. */
export function weeklyAdRetryDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function emptyWeeklyAdRetryState(date: string): WeeklyAdRetryState {
  return { date, counts: {}, thinStamps: {} };
}

/** Identical means the same distinct-card count and the same parsed-offer count. */
export function weeklyAdThinSignature(input: {
  seenCards: number;
  parsedOffers: number;
}): string {
  return `${input.seenCards}:${input.parsedOffers}`;
}

export function noteWeeklyAdThinResult(
  state: WeeklyAdRetryState,
  chainId: string,
  signature: string,
): WeeklyAdRetryState {
  const previous = state.thinStamps[chainId];
  const identical = previous?.signature === signature ? previous.identical + 1 : 1;
  return {
    ...state,
    thinStamps: {
      ...state.thinStamps,
      [chainId]: { signature, identical },
    },
  };
}

export function parseWeeklyAdRetryState(raw: string, today: string): WeeklyAdRetryState {
  try {
    const parsed = JSON.parse(raw) as {
      date?: unknown;
      counts?: unknown;
      thinStamps?: unknown;
    };
    if (parsed.date !== today || !parsed.counts || typeof parsed.counts !== "object") {
      return emptyWeeklyAdRetryState(today);
    }
    const counts: Record<string, number> = {};
    for (const [chainId, value] of Object.entries(parsed.counts)) {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        counts[chainId] = value;
      }
    }
    return { date: today, counts, thinStamps: readThinStamps(parsed.thinStamps) };
  } catch {
    return emptyWeeklyAdRetryState(today);
  }
}

function readThinStamps(value: unknown): Record<string, WeeklyAdRetryThinStamp> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const stamps: Record<string, WeeklyAdRetryThinStamp> = {};
  for (const [chainId, stamp] of Object.entries(value)) {
    if (!stamp || typeof stamp !== "object") {
      continue;
    }
    const signature = (stamp as { signature?: unknown }).signature;
    const identical = (stamp as { identical?: unknown }).identical;
    if (typeof signature !== "string" || signature.length === 0) {
      continue;
    }
    if (typeof identical !== "number" || !Number.isInteger(identical) || identical < 1) {
      continue;
    }
    stamps[chainId] = { signature, identical };
  }
  return stamps;
}

/**
 * First admitted chain, in the given order, that still needs a retry and is
 * under today's limit. A chain needs a retry when it has no fresh rows or its
 * latest parse was thin. The six-attempt cap still applies.
 * A thin chain is skipped after two identical thin results that day.
 * A chain with no fresh rows and no thin stamp is still eligible.
 */
export function selectWeeklyAdRetryChain(input: {
  candidates: readonly WeeklyAdRetryCandidate[];
  attemptsToday: Readonly<Record<string, number>>;
  maxPerDay: number;
  thinStamps?: Readonly<Record<string, WeeklyAdRetryThinStamp>>;
}): string | null {
  for (const candidate of input.candidates) {
    if (candidate.freshCount > 0 && candidate.thinPage !== true) {
      continue;
    }
    const stamp = input.thinStamps?.[candidate.chainId];
    if (
      candidate.thinPage === true &&
      (stamp?.identical ?? 0) >= WEEKLY_AD_THIN_IDENTICAL_LIMIT
    ) {
      continue;
    }
    const attempts = input.attemptsToday[candidate.chainId] ?? 0;
    if (attempts >= input.maxPerDay) {
      continue;
    }
    return candidate.chainId;
  }
  return null;
}

export function bumpWeeklyAdRetryCount(
  state: WeeklyAdRetryState,
  chainId: string,
): WeeklyAdRetryState {
  return {
    date: state.date,
    counts: {
      ...state.counts,
      [chainId]: (state.counts[chainId] ?? 0) + 1,
    },
    thinStamps: state.thinStamps,
  };
}
