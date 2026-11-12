/**
 * Daytime retry for chains that have no fresh ranked rows.
 * Installed in docker/ingest/crontab. One chain per run. Does not write an ingest_jobs row.
 * A run that cannot take the weekly-ad lock skips and does not count an attempt.
 *
 * Container TZ is America/New_York. This does not replace the 3:00am run.
 *
 * 0 6-12 * * * root . /etc/yum4less/ingest.env && cd /app && /usr/local/bin/npm run ingest:weekly-ads:retry >> /var/log/yum4less/ingest.log 2>&1
 *
 * YUM4LESS_WEEKLY_AD_RETRY_MAX_PER_DAY defaults to 7, one try per slot from
 * 6am through noon. A thin chain still stops after two identical results, so
 * the noon slot is only reached by a chain that still has zero fresh rows.
 */

export const WEEKLY_AD_RETRY_MAX_PER_DAY_DEFAULT = 7;
/** Stop thin retries after this many identical thin results in one New York day. */
export const WEEKLY_AD_THIN_IDENTICAL_LIMIT = 2;

export type WeeklyAdRetryCandidate = {
  chainId: string;
  freshCount: number;
  /** Latest parse was thin. Retried even when fresh rows remain. */
  thinPage?: boolean;
  /**
   * chain_registry.sort_order. Orders chains inside one group
   * (no fresh rows, or only thin). Missing values keep the caller's order.
   */
  sortOrder?: number;
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
 * A chain with no fresh rows is always ahead of a chain that only has a thin
 * page, whatever sort_order says. Inside each group the order is sort_order,
 * then chain_id. The six-attempt cap still applies. A thin chain is skipped
 * after two identical thin results that day. A chain with no fresh rows and
 * no thin stamp is still eligible.
 */
export function selectWeeklyAdRetryChain(input: {
  candidates: readonly WeeklyAdRetryCandidate[];
  attemptsToday: Readonly<Record<string, number>>;
  maxPerDay: number;
  thinStamps?: Readonly<Record<string, WeeklyAdRetryThinStamp>>;
}): string | null {
  for (const candidate of orderWeeklyAdRetryCandidates(input.candidates)) {
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

/**
 * The skip line when no chain is chosen.
 * No stale or thin chain: nothing needs a retry.
 * A chain that needed a retry and is at the daily cap: say so.
 * The identical-thin stop does not mention the cap.
 */
export function weeklyAdRetrySkipMessage(input: {
  candidates: readonly WeeklyAdRetryCandidate[];
  attemptsToday: Readonly<Record<string, number>>;
  maxPerDay: number;
  thinStamps?: Readonly<Record<string, WeeklyAdRetryThinStamp>>;
}): string {
  const needy = input.candidates.filter(
    (candidate) => candidate.freshCount <= 0 || candidate.thinPage === true,
  );
  if (needy.length === 0) {
    return "[weekly-ad-retry] nothing needs a retry.";
  }
  const eligible = needy.some((candidate) => {
    if ((input.attemptsToday[candidate.chainId] ?? 0) >= input.maxPerDay) {
      return false;
    }
    const stamp = input.thinStamps?.[candidate.chainId];
    if (
      candidate.thinPage === true &&
      (stamp?.identical ?? 0) >= WEEKLY_AD_THIN_IDENTICAL_LIMIT
    ) {
      return false;
    }
    return true;
  });
  if (eligible) {
    return "[weekly-ad-retry] nothing needs a retry.";
  }
  const hitCap = needy.some(
    (candidate) => (input.attemptsToday[candidate.chainId] ?? 0) >= input.maxPerDay,
  );
  if (hitCap) {
    return "[weekly-ad-retry] a chain needed a retry but has hit today's limit.";
  }
  return "[weekly-ad-retry] nothing needs a retry.";
}

/** Zero-fresh first. Within a group, sort_order then chain_id. */
export function orderWeeklyAdRetryCandidates(
  candidates: readonly WeeklyAdRetryCandidate[],
): WeeklyAdRetryCandidate[] {
  const indexed = candidates.map((candidate, index) => ({ candidate, index }));
  const byRegistry = (
    left: { candidate: WeeklyAdRetryCandidate; index: number },
    right: { candidate: WeeklyAdRetryCandidate; index: number },
  ) => {
    const leftOrder = left.candidate.sortOrder;
    const rightOrder = right.candidate.sortOrder;
    const leftKnown = typeof leftOrder === "number";
    const rightKnown = typeof rightOrder === "number";
    if (leftKnown && rightKnown && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (leftKnown && rightKnown) {
      const byId = left.candidate.chainId.localeCompare(right.candidate.chainId);
      if (byId !== 0) {
        return byId;
      }
    }
    if (leftKnown !== rightKnown) {
      return leftKnown ? -1 : 1;
    }
    return left.index - right.index;
  };
  const noFreshRows = indexed.filter((row) => row.candidate.freshCount === 0);
  const onlyThin = indexed.filter((row) => row.candidate.freshCount !== 0);
  noFreshRows.sort(byRegistry);
  onlyThin.sort(byRegistry);
  return [...noFreshRows, ...onlyThin].map((row) => row.candidate);
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
