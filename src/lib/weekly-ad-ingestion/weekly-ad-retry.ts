/**
 * Daytime retry for chains that have no fresh ranked rows.
 * Not installed. One chain per run. Does not write an ingest_jobs row.
 *
 * Container TZ is America/New_York. This does not replace the 3:00am run.
 *
 * 0 6-12 * * * root . /etc/yum4less/ingest.env && cd /app && /usr/local/bin/npm run ingest:weekly-ads:retry >> /var/log/yum4less/ingest.log 2>&1
 *
 * YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY defaults to 6 (the noon slot can still
 * pick a different chain after one chain has used its six).
 */

export const WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT = 6;

export type WeeklyAdRetryCandidate = {
  chainId: string;
  freshCount: number;
};

export type WeeklyAdRetryState = {
  date: string;
  counts: Record<string, number>;
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
  return { date, counts: {} };
}

export function parseWeeklyAdRetryState(raw: string, today: string): WeeklyAdRetryState {
  try {
    const parsed = JSON.parse(raw) as { date?: unknown; counts?: unknown };
    if (parsed.date !== today || !parsed.counts || typeof parsed.counts !== "object") {
      return emptyWeeklyAdRetryState(today);
    }
    const counts: Record<string, number> = {};
    for (const [chainId, value] of Object.entries(parsed.counts)) {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        counts[chainId] = value;
      }
    }
    return { date: today, counts };
  } catch {
    return emptyWeeklyAdRetryState(today);
  }
}

/**
 * First admitted chain, in the given order, that has no fresh rows and is
 * still under today's limit. A chain with fresh official or flyer rows is skipped.
 */
export function selectWeeklyAdRetryChain(input: {
  candidates: readonly WeeklyAdRetryCandidate[];
  attemptsToday: Readonly<Record<string, number>>;
  maxPerDay: number;
}): string | null {
  for (const candidate of input.candidates) {
    if (candidate.freshCount > 0) {
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
  };
}
