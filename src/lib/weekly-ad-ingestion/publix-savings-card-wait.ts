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
export const PUBLIX_HARVEST_MIN_SHARE_DEFAULT = 0.5;
export const PUBLIX_FEED_MIN_SHARE_DEFAULT = 0.25;

export type PublixCardPollStop = "stable" | "half" | "listed" | "max-wait" | "bottom";

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
/**
 * Off unless set to exactly "1".
 * On: the printed result count does not stop the scroll.
 * The scroll stops at the bottom of the list, after three polls with no new
 * distinct card, or at the capped wait.
 */
export function readPublixPrintedTotalIsFloor(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.YUM4LESS_PUBLIX_PRINTED_TOTAL_IS_FLOOR?.trim() === "1";
}

/**
 * On unless set to exactly "0".
 * Unset and "1" keep cards from the main page and each section page.
 * "0" keeps only the final page.
 */
export function readPublixMergeSectionCards(
  env: NodeJS.ProcessEnv | { YUM4LESS_PUBLIX_MERGE_SECTION_CARDS?: string } = process.env,
): boolean {
  return env.YUM4LESS_PUBLIX_MERGE_SECTION_CARDS?.trim() !== "0";
}

export type PublixVirtualCardList = {
  keys: readonly string[];
  /** Index of the first card the virtual window has mounted. */
  scrollIndex: number;
  windowSize: number;
};

/** Last index a down-only scroll can sit on and still show a full window. */
export function publixVirtualListMaxIndex(
  list: Pick<PublixVirtualCardList, "keys" | "windowSize">,
): number {
  const windowSize = Math.max(1, list.windowSize);
  return Math.max(0, list.keys.length - windowSize);
}

/** Cards mounted in the current window. A virtual list does not keep the rest. */
export function publixMountedCardKeys(list: PublixVirtualCardList): string[] {
  const windowSize = Math.max(1, list.windowSize);
  const maxIndex = publixVirtualListMaxIndex({ keys: list.keys, windowSize });
  const start = Math.max(0, Math.min(list.scrollIndex, maxIndex));
  return list.keys.slice(start, start + windowSize);
}

/**
 * Same direction as the browser helper: add to the scroll index, never subtract.
 * Already at the bottom stays on the tail window.
 */
export function scrollPublixVirtualListDown(
  list: PublixVirtualCardList,
  stepCards: number,
): PublixVirtualCardList {
  const maxIndex = publixVirtualListMaxIndex(list);
  const step = Number.isFinite(stepCards) && stepCards > 0 ? Math.floor(stepCards) : 1;
  return {
    ...list,
    scrollIndex: Math.min(Math.max(0, list.scrollIndex) + step, maxIndex),
  };
}

/** Top of the virtual list and of the window. The browser helper sets both scroll positions to 0. */
export function resetPublixVirtualListToTop(list: PublixVirtualCardList): PublixVirtualCardList {
  return { ...list, scrollIndex: 0 };
}

/**
 * One settle: optional reset to the top, read the mounted window, then scroll
 * down until the list cannot move. Down-only from the bottom keeps the tail.
 */
export function harvestPublixVirtualList(input: {
  keys: readonly string[];
  startIndex: number;
  windowSize: number;
  stepCards: number;
  resetToTop: boolean;
}): string[] {
  let list: PublixVirtualCardList = {
    keys: input.keys,
    scrollIndex: input.startIndex,
    windowSize: input.windowSize,
  };
  if (input.resetToTop) {
    list = resetPublixVirtualListToTop(list);
  }
  const seen: string[] = [];
  const seenSet = new Set<string>();
  const maxIndex = publixVirtualListMaxIndex(list);
  for (;;) {
    for (const key of publixMountedCardKeys(list)) {
      if (seenSet.has(key)) {
        continue;
      }
      seenSet.add(key);
      seen.push(key);
    }
    if (list.scrollIndex >= maxIndex) {
      break;
    }
    const next = scrollPublixVirtualListDown(list, input.stepCards);
    if (next.scrollIndex === list.scrollIndex) {
      break;
    }
    list = next;
  }
  return seen;
}

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

/** Letters and digits only, so "BOGO" and "bogo" name the same section. */
export function normalizePublixSectionId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Each heading owns the "N results" text before the next heading.
 * A category id owns a count only when no other category id sits between
 * them. A wrapper that contains another category does not take that category's
 * number. Heading text wins when the page has headings.
 */
export function parsePublixCategoryResultCounts(html: string): PublixCategoryResultCount[] {
  const fromHeadings = publixCountsFromHeadings(html);
  if (fromHeadings.length > 0) {
    return fromHeadings;
  }
  return publixCountsFromCategoryIds(html);
}

function publixCountsFromHeadings(html: string): PublixCategoryResultCount[] {
  const counts: PublixCategoryResultCount[] = [];
  const seen = new Set<string>();
  const headings = [...html.matchAll(/<h2\b[^>]*>\s*([^<]{1,80}?)\s*<\/h2>/gi)];
  for (let index = 0; index < headings.length; index += 1) {
    const name = headings[index]?.[1] ?? "";
    const start = (headings[index]?.index ?? 0) + (headings[index]?.[0].length ?? 0);
    const nextHeading = headings[index + 1]?.index ?? html.length;
    const window = html.slice(start, Math.min(nextHeading, start + 500));
    const countMatch = /(\d{1,5})\s+results\b/i.exec(window);
    pushPublixCategoryResultCount(counts, seen, normalizePublixSectionId(name), countMatch?.[1]);
  }
  return counts;
}

function publixCountsFromCategoryIds(html: string): PublixCategoryResultCount[] {
  const counts: PublixCategoryResultCount[] = [];
  const seen = new Set<string>();
  const ids = [...html.matchAll(/data-weekly-ad-category-id=["']([^"']+)["']/gi)];
  for (let index = 0; index < ids.length; index += 1) {
    const start = (ids[index]?.index ?? 0) + (ids[index]?.[0].length ?? 0);
    const end = ids[index + 1]?.index ?? html.length;
    const slice = html.slice(start, end).slice(0, 900);
    const countMatch = /(\d{1,5})\s+results\b/i.exec(slice);
    pushPublixCategoryResultCount(
      counts,
      seen,
      normalizePublixSectionId(ids[index]?.[1] ?? ""),
      countMatch?.[1],
    );
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

/**
 * "0" keeps only the final page.
 * On (unset or "1") unions the main page, each section that loaded, then the final page.
 * A null section failed to load and adds nothing. The first HTML for a key wins.
 */
export function collectPublixHarvestCards(input: {
  mergeSectionCards: boolean;
  mainCards: readonly { key: string; html: string }[];
  sectionCards: readonly (readonly { key: string; html: string }[] | null)[];
  finalCards: readonly { key: string; html: string }[];
}): Map<string, string> {
  const seen = new Map<string, string>();
  if (!input.mergeSectionCards) {
    rememberPublixCardHtml(seen, input.finalCards);
    return seen;
  }
  rememberPublixCardHtml(seen, input.mainCards);
  for (const section of input.sectionCards) {
    if (!section) {
      continue;
    }
    rememberPublixCardHtml(seen, section);
  }
  rememberPublixCardHtml(seen, input.finalCards);
  return seen;
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

/**
 * The printed count for the section on screen.
 * A named section uses only that section. Any other count is ignored.
 * With no section name, one printed count is used. Several counts mean the
 * page cannot be told, so the result is null. Counts are not added together.
 * A null result does not stop the scroll as "listed" and does not make the
 * page look full.
 */
export function publixListedCardTarget(
  counts: readonly PublixCategoryResultCount[],
  shownSection?: string | null,
): number | null {
  const sectionId = shownSection ? normalizePublixSectionId(shownSection) : "";
  if (sectionId) {
    const matches = counts.filter((item) => item.categoryId === sectionId);
    return matches.length === 1 ? matches[0].count : null;
  }
  if (counts.length === 1) {
    return counts[0].count;
  }
  return null;
}

/**
 * A later reading can raise the printed target. It cannot lower it.
 * A smaller number from another category must not make the page look full.
 */
export function nextPublixExpectedCount(
  current: number | null,
  listed: number | null,
): number | null {
  if (listed === null || listed <= 0) {
    return current;
  }
  if (current === null) {
    return listed;
  }
  return Math.max(current, listed);
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

function readPublixShare(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) {
    return parsed;
  }
  return fallback;
}

/** Share of the largest section page the saved harvest must reach. Default 0.5. */
export function readPublixHarvestMinShare(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return readPublixShare(env.YUM4LESS_PUBLIX_HARVEST_MIN_SHARE, PUBLIX_HARVEST_MIN_SHARE_DEFAULT);
}

/** Share of a non-empty savings feed the saved harvest must reach. Default 0.25. */
export function readPublixFeedMinShare(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return readPublixShare(env.YUM4LESS_PUBLIX_FEED_MIN_SHARE, PUBLIX_FEED_MIN_SHARE_DEFAULT);
}

/** Length of the Savings array. Null when that array was not in the summary. */
export function publixSavingsFeedItemCount(
  summary: PublixSavingsCallSummary | null,
): number | null {
  if (!summary) {
    return null;
  }
  const savings = summary.arrayLengths.find((item) => item.name === "Savings");
  return savings ? savings.length : null;
}

/**
 * Saved cards against the largest section page, then against a non-empty feed.
 * An empty or missing feed skips the second check. The first failing check
 * supplies the reason. Neither check changes the printed-count thin rule.
 */
export function assessPublixHarvest(input: {
  harvestedCards: number;
  sections: readonly { section: string; cards: number }[];
  feedItemCount: number | null;
  harvestMinShare?: number;
  feedMinShare?: number;
}): { thin: boolean; reason: string | null } {
  const harvestMinShare = input.harvestMinShare ?? PUBLIX_HARVEST_MIN_SHARE_DEFAULT;
  const feedMinShare = input.feedMinShare ?? PUBLIX_FEED_MIN_SHARE_DEFAULT;
  const largest = input.sections.reduce<{ section: string; cards: number } | null>(
    (best, row) => (!best || row.cards > best.cards ? row : best),
    null,
  );
  if (largest && largest.cards > 0 && input.harvestedCards < largest.cards * harvestMinShare) {
    return {
      thin: true,
      reason: `saved ${input.harvestedCards} cards but the ${largest.section} page showed ${largest.cards}`,
    };
  }
  if (
    input.feedItemCount !== null &&
    input.feedItemCount > 0 &&
    input.harvestedCards < input.feedItemCount * feedMinShare
  ) {
    return {
      thin: true,
      reason: `saved ${input.harvestedCards} cards but the savings feed listed ${input.feedItemCount}`,
    };
  }
  return { thin: false, reason: null };
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
  /** When true, reaching the printed count does not stop the scroll. */
  printedTotalIsFloor?: boolean;
  /** The virtual list or the page itself cannot scroll further. */
  atBottom?: boolean;
  /** Polls in a row with the same distinct-card count, including this one. */
  distinctStablePolls?: number;
  distinctCount?: number;
}): "continue" | PublixCardPollStop {
  const seen = input.seenCount ?? input.count;
  if (input.printedTotalIsFloor === true) {
    if (input.atBottom === true) {
      return "bottom";
    }
    const distinctCount = input.distinctCount ?? 0;
    if (
      distinctCount > 0 &&
      (input.distinctStablePolls ?? 0) >= PUBLIX_CARD_STABLE_POLLS
    ) {
      return "stable";
    }
    if (input.elapsedMs >= input.maxWaitMs) {
      return "max-wait";
    }
    return "continue";
  }
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

export type PublixSectionLog = {
  section: string;
  printed: number | null;
  cards: number;
  offers: number;
  polls: number;
  waitMs: number;
  stop: string;
};

export type PublixSavingsCallSummary = {
  status: number;
  byteLength: number;
  keys: string[];
  arrayLengths: { name: string; length: number }[];
  weeklyAdLatestUpdatedDateTime: string | null;
};

/** Keys, array lengths, and the update timestamp. Values other than that timestamp stay out. */
export function summarizePublixSavingsBody(input: {
  status: number;
  body: string;
}): PublixSavingsCallSummary {
  const byteLength = Buffer.byteLength(input.body);
  const keys: string[] = [];
  const arrayLengths: { name: string; length: number }[] = [];
  let weeklyAdLatestUpdatedDateTime: string | null = null;
  try {
    const parsed = JSON.parse(input.body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      for (const key of Object.keys(record).sort()) {
        if (SECRET_QUERY_KEY.test(key)) {
          continue;
        }
        keys.push(key);
        const value = record[key];
        if (Array.isArray(value)) {
          arrayLengths.push({ name: key, length: value.length });
        }
      }
      const updated = record.WeeklyAdLatestUpdatedDateTime;
      if (
        typeof updated === "string" &&
        updated.length > 0 &&
        updated.length <= 40 &&
        !/[\r\n]/.test(updated)
      ) {
        weeklyAdLatestUpdatedDateTime = updated;
      }
    }
  } catch {
    // Status and byte length still describe the call.
  }
  return {
    status: input.status,
    byteLength,
    keys,
    arrayLengths,
    weeklyAdLatestUpdatedDateTime,
  };
}

export function formatPublixSectionLogLine(input: PublixSectionLog): string {
  const printed = input.printed === null ? "none" : String(input.printed);
  return `[publix] section=${input.section} printed=${printed} cards=${input.cards} offers=${input.offers} polls=${input.polls} waitMs=${input.waitMs} stop=${input.stop}`;
}

export function formatPublixHarvestSummaryLine(input: {
  sections: number;
  cards: number;
  offers: number;
  polls: number;
  waitMs: number;
  harvestCards: number | null;
  harvestOffers: number | null;
  savings: PublixSavingsCallSummary | null;
}): string {
  const savings = input.savings;
  const savingsKeys = savings && savings.keys.length > 0 ? savings.keys.join(",") : "none";
  const savingsArrays =
    savings && savings.arrayLengths.length > 0
      ? savings.arrayLengths.map((item) => `${item.name}:${item.length}`).join(",")
      : "none";
  return [
    "[publix] summary",
    `sections=${input.sections}`,
    `sectionCards=${input.cards}`,
    `sectionOffers=${input.offers}`,
    `sectionPolls=${input.polls}`,
    `sectionWaitMs=${input.waitMs}`,
    `harvestCards=${input.harvestCards === null ? "none" : input.harvestCards}`,
    `harvestOffers=${input.harvestOffers === null ? "none" : input.harvestOffers}`,
    `savingsStatus=${savings ? savings.status : "none"}`,
    `savingsBytes=${savings ? savings.byteLength : "none"}`,
    `savingsKeys=${savingsKeys}`,
    `savingsArrays=${savingsArrays}`,
    `updated=${savings?.weeklyAdLatestUpdatedDateTime ?? "none"}`,
  ].join(" ");
}

export function logPublixLine(line: string): void {
  try {
    const text = line.startsWith("[nightly] ") ? line : `[nightly] ${line}`;
    console.info(text);
  } catch {
    // A log line must not fail the scrape.
  }
}
