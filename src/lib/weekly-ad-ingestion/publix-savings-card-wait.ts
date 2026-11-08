/**
 * Publix savings-card settle rules.
 * The browser used to return on the first non-zero card count.
 * When the page prints "221 results" under a category heading, that number is
 * the count to reach. A stable handful of cards is not enough while the
 * mounted count is still under it. The wait then runs until the mounted or
 * distinct cards reach that count, or the max wait elapses.
 * With no printed count, a count is enough when it reaches at least half of
 * the remembered raw card count, or when the same positive count has been
 * seen three times and that count is not thin.
 * A thin count keeps waiting until the max wait. A thin count does not
 * replace the memory.
 *
 * Thin means under the printed result count when the page has one. Otherwise
 * under half of a positive remembered count, or under
 * YUM4LESS_PUBLIX_THIN_MIN_CARDS (default 50) when nothing is remembered.
 */

export const PUBLIX_CARD_POLL_MS = 1_000;
export const PUBLIX_CARD_STABLE_POLLS = 3;
export const PUBLIX_CARD_MAX_WAIT_MS_DEFAULT = 20_000;
export const PUBLIX_CARD_MAX_WAIT_MS_MIN = 1_000;
export const PUBLIX_CARD_MAX_WAIT_MS_MAX = 60_000;
export const PUBLIX_CARD_SCROLL_VIEWPORTS_DEFAULT = 3;
export const PUBLIX_CARD_SCROLL_VIEWPORTS_MIN = 1;
export const PUBLIX_CARD_SCROLL_VIEWPORTS_MAX = 5;
export const PUBLIX_THIN_MIN_CARDS_DEFAULT = 50;

export type PublixCardPollStop = "stable" | "half" | "listed" | "max-wait";

export type PublixCategoryResultCount = {
  categoryId: string;
  count: number;
};

export type PublixResponseStatus = {
  status: number;
  url: string;
};

const SECRET_QUERY_KEY = /^(token|access_token|id_token|sig|signature|key|api_key|apikey)$/i;

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

/** How many viewports each poll scrolls. Default 3. Out-of-range values use the default. */
export function readPublixCardScrollViewports(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(env.YUM4LESS_PUBLIX_CARD_SCROLL_VIEWPORTS);
  if (
    Number.isInteger(configured) &&
    configured >= PUBLIX_CARD_SCROLL_VIEWPORTS_MIN &&
    configured <= PUBLIX_CARD_SCROLL_VIEWPORTS_MAX
  ) {
    return configured;
  }
  return PUBLIX_CARD_SCROLL_VIEWPORTS_DEFAULT;
}

/** Pixel step for one poll. The page uses this same formula with window.innerHeight. */
export function publixCardScrollStepPx(viewportHeight: number, viewports: number): number {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 400;
  const steps =
    Number.isInteger(viewports) && viewports >= 1
      ? viewports
      : PUBLIX_CARD_SCROLL_VIEWPORTS_DEFAULT;
  return Math.max(height, 400) * steps;
}

export function readPublixThinMinCards(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(env.YUM4LESS_PUBLIX_THIN_MIN_CARDS);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 5_000) {
    return configured;
  }
  return PUBLIX_THIN_MIN_CARDS_DEFAULT;
}

/**
 * Under half of a positive remembered count.
 * With no memory, under the minimum card count.
 */
export function publixCardCountIsThin(
  count: number,
  rememberedOfferCount: number | null,
  minCards: number = readPublixThinMinCards(),
): boolean {
  if (rememberedOfferCount === null || rememberedOfferCount <= 0) {
    return count < minCards;
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
 * A category heading and the "N results" text that follows it.
 * The live page puts both inside the element that carries
 * data-weekly-ad-category-id. A heading-only excerpt still counts.
 */
export function parsePublixCategoryResultCounts(html: string): PublixCategoryResultCount[] {
  const counts: PublixCategoryResultCount[] = [];
  const seen = new Set<string>();
  const sectionPattern =
    /data-weekly-ad-category-id=["']([^"']+)["'][\s\S]{0,900}?(\d{1,5})\s+results\b/gi;
  const headingPattern =
    /<h2\b[^>]*>\s*([^<]{1,40}?)\s*<\/h2>[\s\S]{0,500}?(\d{1,5})\s+results\b/gi;

  for (const match of html.matchAll(sectionPattern)) {
    pushPublixCategoryResultCount(counts, seen, match[1], match[2]);
  }
  if (counts.length > 0) {
    return counts;
  }
  for (const match of html.matchAll(headingPattern)) {
    pushPublixCategoryResultCount(counts, seen, match[1], match[2]);
  }
  return counts;
}

function pushPublixCategoryResultCount(
  counts: PublixCategoryResultCount[],
  seen: Set<string>,
  rawId: string | undefined,
  rawCount: string | undefined,
) {
  const categoryId = rawId?.trim().toLowerCase() ?? "";
  const count = Number(rawCount);
  if (!categoryId || !Number.isInteger(count) || count <= 0 || seen.has(categoryId)) {
    return;
  }
  seen.add(categoryId);
  counts.push({ categoryId, count });
}

/** Keep the first HTML seen for each card. A later scroll that drops it does not erase it. */
export function rememberPublixCardHtml(
  seen: Map<string, string>,
  cards: readonly { key: string; html: string }[],
): void {
  for (const card of cards) {
    const key = card.key.trim();
    const html = card.html.trim();
    if (!key || !html || seen.has(key)) {
      continue;
    }
    seen.set(key, html);
  }
}

/** Append scrolled-away cards so the parser is not limited to the last virtual window. */
export function publixCollectedCardsDocument(cards: Iterable<string>): string {
  return `<div id="yum4less-collected-cards">${[...cards].join("\n")}</div>`;
}

/** Sum of the printed category counts. Null when the page did not print one. */
export function publixListedCardTarget(
  counts: readonly PublixCategoryResultCount[],
): number | null {
  if (counts.length === 0) {
    return null;
  }
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  return total > 0 ? total : null;
}

/**
 * Under the printed result count when the page has one.
 * Otherwise the remembered-count rule.
 */
export function publixPageIsThin(input: {
  seenCount: number;
  expectedCount?: number | null;
  rememberedOfferCount: number | null;
  minCards?: number;
}): boolean {
  if (typeof input.expectedCount === "number" && input.expectedCount > 0) {
    return input.seenCount < input.expectedCount;
  }
  return publixCardCountIsThin(
    input.seenCount,
    input.rememberedOfferCount,
    input.minCards,
  );
}

/**
 * Publix savings, promotion, and GraphQL calls.
 * A tracking URL is not relevant just because its query contains the word savings.
 * Status and URL only; the body stays out.
 */
export function publixResponseStatusIsRelevant(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (parsed.hostname === "services.publix.com") {
      return /savings|promotion|graphql/i.test(path);
    }
    if (parsed.hostname === "www.publix.com" || parsed.hostname.endsWith(".publix.com")) {
      return /graphql|promotion/i.test(path) && !path.startsWith("/api/proxy");
    }
    return false;
  } catch {
    return false;
  }
}

export function publixResponseStatusForCapture(input: {
  status: number;
  url: string;
}): PublixResponseStatus {
  try {
    const parsed = new URL(input.url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SECRET_QUERY_KEY.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return { status: input.status, url: parsed.toString() };
  } catch {
    return { status: input.status, url: input.url.split("?")[0] ?? input.url };
  }
}

/**
 * Stop when the mounted cards reach the printed result count.
 * Otherwise stop when the count reached half the memory, when the same
 * positive count has been seen three times and is not thin, or when the
 * max wait has elapsed. A printed count ignores the early half and stable
 * stops. A stable thin count keeps waiting. One unchanged poll is not a stop.
 * A stuck zero keeps waiting.
 */
export function decidePublixCardPoll(input: {
  previousCount: number | null;
  count: number;
  rememberedOfferCount: number | null;
  elapsedMs: number;
  maxWaitMs: number;
  samples: number;
  equalPositiveSamples: number;
  minCards?: number;
  expectedCount?: number | null;
  seenCount?: number;
}): "continue" | PublixCardPollStop {
  const seen = input.seenCount ?? input.count;
  if (typeof input.expectedCount === "number" && input.expectedCount > 0) {
    if (seen >= input.expectedCount) {
      return "listed";
    }
    if (input.elapsedMs >= input.maxWaitMs) {
      return "max-wait";
    }
    return "continue";
  }
  if (publixCardCountReachesHalf(input.count, input.rememberedOfferCount)) {
    return "half";
  }
  const thin = publixCardCountIsThin(
    input.count,
    input.rememberedOfferCount,
    input.minCards,
  );
  if (
    !thin &&
    input.equalPositiveSamples >= PUBLIX_CARD_STABLE_POLLS &&
    input.count > 0
  ) {
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
  expectedCardCount?: number | null;
  parsedOfferCount?: number | null;
  responses?: readonly PublixResponseStatus[];
}) {
  return {
    url: input.url,
    zipCode: input.zipCode ?? null,
    gotoStatus: input.gotoStatus,
    extractedCount: input.extractedCount,
    parsedOfferCount: input.parsedOfferCount ?? null,
    rememberedOfferCount: input.rememberedOfferCount,
    expectedCardCount: input.expectedCardCount ?? null,
    capturedAt: input.capturedAt,
    responses: [...(input.responses ?? [])],
  };
}
