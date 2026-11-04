/**
 * Publix savings-card settle rules.
 * The browser used to return on the first non-zero card count.
 * A count is enough when the same positive count has been seen three times,
 * or when it reaches at least half of the remembered raw card count.
 * A count under that half is thin. A thin count does not replace the memory.
 */

export const PUBLIX_CARD_POLL_MS = 1_000;
export const PUBLIX_CARD_STABLE_POLLS = 3;
export const PUBLIX_CARD_MAX_WAIT_MS_DEFAULT = 20_000;
export const PUBLIX_CARD_MAX_WAIT_MS_MIN = 1_000;
export const PUBLIX_CARD_MAX_WAIT_MS_MAX = 60_000;

export type PublixCardPollStop = "stable" | "half" | "max-wait";

export function readPublixCardMaxWaitMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(env.YUM4LESS_PUBLIX_CARD_MAX_WAIT_MS);
  if (
    Number.isInteger(configured) &&
    configured >= PUBLIX_CARD_MAX_WAIT_MS_MIN &&
    configured <= PUBLIX_CARD_MAX_WAIT_MS_MAX
  ) {
    return configured;
  }
  return PUBLIX_CARD_MAX_WAIT_MS_DEFAULT;
}

/** Incoming count is under half of a positive remembered offer_count. */
export function publixCardCountIsThin(
  count: number,
  rememberedOfferCount: number | null,
): boolean {
  if (rememberedOfferCount === null || rememberedOfferCount <= 0) {
    return false;
  }
  return count * 2 < rememberedOfferCount;
}

export function publixCardCountReachesHalf(
  count: number,
  rememberedOfferCount: number | null,
): boolean {
  if (rememberedOfferCount === null || rememberedOfferCount <= 0) {
    return false;
  }
  return count * 2 >= rememberedOfferCount;
}

/** How many polls in a row have shown this same positive count, including this one. */
export function nextPublixEqualPositiveSamples(input: {
  previousCount: number | null;
  count: number;
  equalPositiveSamples: number;
}): number {
  if (input.count > 0 && input.count === input.previousCount) {
    return input.equalPositiveSamples + 1;
  }
  return input.count > 0 ? 1 : 0;
}

/**
 * Stop when the count reached half the memory, when the same positive count
 * has been seen three times, or when the max wait has elapsed.
 * One unchanged poll is not a stop. A stuck zero keeps waiting.
 */
export function decidePublixCardPoll(input: {
  previousCount: number | null;
  count: number;
  rememberedOfferCount: number | null;
  elapsedMs: number;
  maxWaitMs: number;
  samples: number;
  equalPositiveSamples: number;
}): "continue" | PublixCardPollStop {
  if (publixCardCountReachesHalf(input.count, input.rememberedOfferCount)) {
    return "half";
  }
  if (input.equalPositiveSamples >= PUBLIX_CARD_STABLE_POLLS && input.count > 0) {
    return "stable";
  }
  if (input.elapsedMs >= input.maxWaitMs) {
    return "max-wait";
  }
  return "continue";
}

export function buildPublixThinCaptureMeta(input: {
  url: string;
  zipCode?: string;
  gotoStatus: number | null;
  extractedCount: number;
  rememberedOfferCount: number | null;
  capturedAt: string;
}) {
  return {
    url: input.url,
    zipCode: input.zipCode ?? null,
    gotoStatus: input.gotoStatus,
    extractedCount: input.extractedCount,
    rememberedOfferCount: input.rememberedOfferCount,
    capturedAt: input.capturedAt,
  };
}
