import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";
import {
  buildPublixThinCaptureMeta,
  decidePublixCardPoll,
  formatPublixHarvestSummaryLine,
  formatPublixSectionLogLine,
  logPublixLine,
  nextPublixEqualPositiveSamples,
  parsePublixCategoryResultCounts,
  PUBLIX_CARD_POLL_MS,
  publixCollectedCardsDocument,
  publixListedCardTarget,
  rememberPublixCardHtml,
  publixPageIsThin,
  publixResponseStatusForCapture,
  publixResponseStatusIsRelevant,
  readPublixCardMaxWaitMs,
  readPublixCardScrollViewports,
  readPublixPrintedTotalIsFloor,
  summarizePublixSavingsBody,
  type PublixResponseStatus,
  type PublixSavingsCallSummary,
  type PublixSectionLog,
} from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import {
  serializePublixStoreCookie,
} from "@/lib/providers/publix/publix-services-api-client";
import type { PublixStoreCookie } from "@/lib/providers/publix/publix-services-api-types";
import {
  appendEmbeddedWeeklyAdJson,
  attachWeeklyAdNetworkCapture,
  fetchBrowserWithRetries,
  fetchWeeklyAdHtmlOverHttp,
  scrollPageForLazyContent,
} from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";

export const PUBLIX_BROWSER_FETCH_TIMEOUT_MS = 90_000;
export const PUBLIX_BROWSER_RETRY_COUNT = 2;
export const PUBLIX_SAVINGS_CARD_SELECTOR =
  '[data-qa-automation="listed-savings-card"]';

const PUBLIX_NETWORK_URL_PATTERN =
  /publix|weekly|savings|flyer|flipp|offer|product|deal|coupon|graphql|services\.publix/i;

const PUBLIX_WAIT_SELECTOR =
  "#weekly-ad-offers-data, [data-weekly-ad-product], .weekly-ad, [class*='weekly'], [class*='WeeklyAd'], iframe";

const PUBLIX_WEEKLY_AD_CATEGORY_SLUGS = [
  "bogo",
  "meat",
  "produce",
  "dairy",
  "protein",
] as const;

export type PublixWeeklyAdFetchResult = {
  html: string;
  method: "http" | "browser";
  networkJsonBodies: string[];
  waitSelectorMatched: boolean;
  attempts: number;
  storeCookie?: PublixStoreCookie;
  visitedUrls?: string[];
  savingsCardCount?: number;
  seenCardCount?: number;
  expectedCardCount?: number | null;
  gotoStatus?: number | null;
};

export type PublixWeeklyAdFetcherDeps = {
  fetchHttpHtml?: (url: string, storeCookie?: PublixStoreCookie) => Promise<string>;
  fetchBrowserPage?: (input: {
    url: string;
    waitSelector: string;
    timeoutMs: number;
    storeCookie?: PublixStoreCookie;
    rememberedOfferCount?: number | null;
    zipCode?: string;
    maxWaitMs?: number;
  }) => Promise<{
    html: string;
    networkJsonBodies: string[];
    waitSelectorMatched: boolean;
    visitedUrls?: string[];
    savingsCardCount?: number;
    seenCardCount?: number;
    expectedCardCount?: number | null;
    gotoStatus?: number | null;
  }>;
};

export async function fetchPublixWeeklyAdPage(input: {
  url: string;
  storeCookie?: PublixStoreCookie;
  rememberedOfferCount?: number | null;
  zipCode?: string;
  deps?: PublixWeeklyAdFetcherDeps;
}): Promise<PublixWeeklyAdFetchResult> {
  const fetchHttp = input.deps?.fetchHttpHtml ?? fetchPublixWeeklyAdHtmlOverHttp;
  const fetchBrowser = input.deps?.fetchBrowserPage ?? fetchPublixWeeklyAdWithBrowser;
  const browserDisabled = process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER === "1";

  if (!browserDisabled) {
    const browserResult = await fetchBrowserWithRetries(
      () =>
        fetchBrowser({
          url: input.url,
          waitSelector: PUBLIX_WAIT_SELECTOR,
          timeoutMs: PUBLIX_BROWSER_FETCH_TIMEOUT_MS,
          storeCookie: input.storeCookie,
          rememberedOfferCount: input.rememberedOfferCount ?? null,
          zipCode: input.zipCode,
          maxWaitMs: readPublixCardMaxWaitMs(),
        }),
      PUBLIX_BROWSER_RETRY_COUNT,
    );
    return {
      html: browserResult.html,
      method: "browser",
      networkJsonBodies: browserResult.networkJsonBodies,
      waitSelectorMatched: browserResult.waitSelectorMatched,
      attempts: browserResult.attempts,
      storeCookie: input.storeCookie,
      visitedUrls: browserResult.visitedUrls,
      savingsCardCount: browserResult.savingsCardCount,
      seenCardCount: browserResult.seenCardCount,
      expectedCardCount: browserResult.expectedCardCount,
      gotoStatus: browserResult.gotoStatus,
    };
  }

  const httpHtml = await fetchHttp(input.url, input.storeCookie);
  return {
    html: httpHtml,
    method: "http",
    networkJsonBodies: [],
    waitSelectorMatched: false,
    attempts: 1,
    storeCookie: input.storeCookie,
  };
}

export async function fetchPublixWeeklyAdHtmlOverHttp(
  url: string,
  storeCookie?: PublixStoreCookie,
): Promise<string> {
  const headers: Record<string, string> = {};
  if (storeCookie) {
    headers.Cookie = `Store=${encodeURIComponent(serializePublixStoreCookie(storeCookie))}`;
  }

  return fetchWeeklyAdHtmlOverHttp({ url, timeoutMs: 15_000, headers });
}

export async function fetchPublixWeeklyAdWithBrowser(input: {
  url: string;
  waitSelector: string;
  timeoutMs: number;
  storeCookie?: PublixStoreCookie;
  rememberedOfferCount?: number | null;
  zipCode?: string;
  maxWaitMs?: number;
}): Promise<{
  html: string;
  networkJsonBodies: string[];
  waitSelectorMatched: boolean;
  visitedUrls: string[];
  savingsCardCount: number;
  seenCardCount: number;
  expectedCardCount: number | null;
  gotoStatus: number | null;
}> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const networkJsonBodies: string[] = [];
  const responseStatuses: PublixResponseStatus[] = [];

  try {
    const context = await browser.newContext(getWeeklyAdBrowserContextOptions());

    if (input.storeCookie) {
      await context.addCookies([
        {
          name: "Store",
          value: serializePublixStoreCookie(input.storeCookie),
          domain: ".publix.com",
          path: "/",
        },
      ]);
    }

    const page = await context.newPage();
    page.setDefaultTimeout(input.timeoutMs);

    attachPublixResponseStatuses(page, responseStatuses);
    attachWeeklyAdNetworkCapture(page, networkJsonBodies, PUBLIX_NETWORK_URL_PATTERN, {
      allowGraphqlUrl: true,
      allowServicesDomain: true,
      requireJsonPrefix: true,
    });

    const visitedUrls: string[] = [];
    const firstGoto = await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs,
    });
    let gotoStatus = firstGoto?.status() ?? null;
    visitedUrls.push(page.url());

    const acceptCookies = page.locator("#onetrust-accept-btn-handler").first();
    if (await acceptCookies.count()) {
      await acceptCookies.click({ timeout: 5_000 }).catch(() => undefined);
    }

    let waitSelectorMatched = false;
    try {
      await page.waitForSelector(input.waitSelector, {
        timeout: Math.min(input.timeoutMs, 15_000),
      });
      waitSelectorMatched = true;
    } catch {
      // Some Publix pages never expose known selectors; still capture HTML/network.
    }

    await page.waitForTimeout(2_000);
    await scrollPageForLazyContent(page);

    const rememberedOfferCount = input.rememberedOfferCount ?? null;
    const maxWaitMs = input.maxWaitMs ?? readPublixCardMaxWaitMs();
    const scrollViewports = readPublixCardScrollViewports();
    const printedTotalIsFloor = readPublixPrintedTotalIsFloor();
    const savingsCalls: PublixSavingsCallSummary[] = [];
    attachPublixSavingsCallSummary(page, savingsCalls);
    const collectedCards = new Map<string, string>();
    const sectionLogs: PublixSectionLog[] = [];
    await explorePublixWeeklyAdCategories(page, input.url, visitedUrls, input.timeoutMs, {
      rememberedOfferCount,
      maxWaitMs,
      scrollViewports,
      printedTotalIsFloor,
      sectionLogs,
    });
    let settled = await settlePublixSavingsCardCount(page, {
      timeoutMs: input.timeoutMs,
      rememberedOfferCount,
      maxWaitMs,
      scrollViewports,
      printedTotalIsFloor,
      collectedCards,
    });

    if (
      publixPageIsThin({
        seenCount: settled.seenCount,
        expectedCount: settled.expectedCount,
        rememberedOfferCount,
      })
    ) {
      const retryGoto = await page.goto(input.url, {
        waitUntil: "domcontentloaded",
        timeout: input.timeoutMs,
      });
      gotoStatus = retryGoto?.status() ?? gotoStatus;
      if (!visitedUrls.includes(page.url())) {
        visitedUrls.push(page.url());
      }
      await scrollPageForLazyContent(page);
      settled = await settlePublixSavingsCardCount(page, {
        timeoutMs: input.timeoutMs,
        rememberedOfferCount,
        maxWaitMs,
        scrollViewports,
        printedTotalIsFloor,
        collectedCards,
      });
    }

    const savingsCardCount = settled.seenCount;
    const pageHtml = await page.content();
    const html =
      collectedCards.size > 0
        ? `${pageHtml}\n${publixCollectedCardsDocument(collectedCards.values())}`
        : pageHtml;
    await appendEmbeddedWeeklyAdJson(page, networkJsonBodies);
    const parsedOfferCount = parsePublixWeeklyAd({
      html,
      networkJsonBodies,
    }).length;
    logPublixHarvestSummary(sectionLogs, settled.seenCount, parsedOfferCount, savingsCalls);
    if (
      publixPageIsThin({
        seenCount: settled.seenCount,
        expectedCount: settled.expectedCount,
        rememberedOfferCount,
      })
    ) {
      savePublixThinCapture({
        html,
        url: input.url,
        zipCode: input.zipCode,
        gotoStatus,
        extractedCount: settled.seenCount,
        parsedOfferCount,
        rememberedOfferCount,
        expectedCardCount: settled.expectedCount,
        responses: responseStatuses,
      });
    }

    return {
      html,
      networkJsonBodies,
      waitSelectorMatched,
      visitedUrls,
      savingsCardCount,
      seenCardCount: settled.seenCount,
      expectedCardCount: settled.expectedCount,
      gotoStatus,
    };
  } finally {
    await browser.close();
  }
}

async function waitForPublixSavingsCards(
  page: import("playwright").Page,
  timeoutMs: number,
) {
  try {
    await page.waitForSelector(PUBLIX_SAVINGS_CARD_SELECTOR, {
      timeout: Math.min(timeoutMs, 25_000),
    });
    return true;
  } catch {
    return false;
  }
}

async function settlePublixSavingsCardCount(
  page: import("playwright").Page,
  input: {
    timeoutMs: number;
    rememberedOfferCount: number | null;
    maxWaitMs: number;
    scrollViewports: number;
    printedTotalIsFloor: boolean;
    collectedCards: Map<string, string>;
  },
): Promise<{
  seenCount: number;
  expectedCount: number | null;
  polls: number;
  waitMs: number;
  stop: string;
}> {
  await waitForPublixSavingsCards(page, input.timeoutMs);
  const started = Date.now();
  const distinct = new Set<string>();
  let previousCount: number | null = null;
  let previousDistinct: number | null = null;
  let samples = 0;
  let equalPositiveSamples = 0;
  let distinctStablePolls = 0;
  let seenCount = 0;
  let expectedCount: number | null = null;

  while (true) {
    const listing = await readPublixCardListing(page);
    rememberPublixCardHtml(input.collectedCards, listing.cards);
    for (const key of listing.keys) {
      distinct.add(key);
    }
    seenCount = Math.max(listing.mounted, distinct.size);
    const listed = publixListedCardTarget(parsePublixCategoryResultCounts(listing.listingHtml));
    if (listed !== null) {
      expectedCount = listed;
    }
    samples += 1;
    equalPositiveSamples = nextPublixEqualPositiveSamples({
      previousCount,
      count: seenCount,
      equalPositiveSamples,
    });
    distinctStablePolls = nextPublixEqualPositiveSamples({
      previousCount: previousDistinct,
      count: distinct.size,
      equalPositiveSamples: distinctStablePolls,
    });
    const elapsedMs = Date.now() - started;
    const decision = decidePublixCardPoll({
      previousCount,
      count: seenCount,
      seenCount,
      expectedCount,
      rememberedOfferCount: input.rememberedOfferCount,
      elapsedMs,
      maxWaitMs: input.maxWaitMs,
      samples,
      equalPositiveSamples,
      printedTotalIsFloor: input.printedTotalIsFloor,
      atBottom: listing.atBottom,
      distinctStablePolls,
      distinctCount: distinct.size,
    });
    if (decision !== "continue") {
      return { seenCount, expectedCount, polls: samples, waitMs: elapsedMs, stop: decision };
    }
    previousCount = seenCount;
    previousDistinct = distinct.size;
    await scrollPublixCardList(page, input.scrollViewports);
    await page.waitForTimeout(PUBLIX_CARD_POLL_MS);
  }
}

async function readPublixCardListing(page: import("playwright").Page): Promise<{
  mounted: number;
  keys: string[];
  listingHtml: string;
  cards: { key: string; html: string }[];
  atBottom: boolean;
}> {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-qa-automation="listed-savings-card"]'),
    );
    const snapshots = cards.flatMap((card) => {
      const coded = card.querySelector("[data-item-code]")?.getAttribute("data-item-code")?.trim();
      const title = card.querySelector('[data-qa-automation="prod-title"]')?.textContent?.trim() ?? "";
      const key = coded || title;
      if (!key) {
        return [];
      }
      return [{ key, html: card.outerHTML }];
    });
    const listingHtml = Array.from(document.querySelectorAll("[data-weekly-ad-category-id]"))
      .map((section) => section.outerHTML)
      .join("\n");
    const container = document.querySelector("[class*='virtual-container']");
    let atBottom = false;
    if (container instanceof HTMLElement) {
      const style = window.getComputedStyle(container);
      const scrollsItself =
        /(auto|scroll)/.test(style.overflowY) &&
        container.scrollHeight > container.clientHeight + 20;
      if (scrollsItself) {
        atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 8;
      }
    }
    if (!atBottom) {
      const scrolling = document.scrollingElement || document.documentElement;
      atBottom = window.innerHeight + window.scrollY >= scrolling.scrollHeight - 8;
    }
    return {
      mounted: cards.length,
      keys: snapshots.map((card) => card.key),
      cards: snapshots,
      listingHtml,
      atBottom,
    };
  });
}

/** Several viewports of the virtual list. The window scrolls when the container does not. */
async function scrollPublixCardList(page: import("playwright").Page, viewports: number) {
  await page.evaluate((stepViewports: number) => {
    const container = document.querySelector("[class*='virtual-container']");
    const step = Math.max(window.innerHeight, 400) * stepViewports;
    if (container instanceof HTMLElement) {
      const style = window.getComputedStyle(container);
      const scrollsItself =
        /(auto|scroll)/.test(style.overflowY) &&
        container.scrollHeight > container.clientHeight + 20;
      if (scrollsItself) {
        container.scrollTop = Math.min(container.scrollTop + step, container.scrollHeight);
      }
    }
    window.scrollBy(0, step);
  }, viewports);
}

function attachPublixSavingsCallSummary(
  page: import("playwright").Page,
  sink: PublixSavingsCallSummary[],
) {
  page.on("response", async (response) => {
    try {
      const parsed = new URL(response.url());
      if (parsed.hostname !== "services.publix.com" || !/savings/i.test(parsed.pathname)) {
        return;
      }
      const body = await response.text();
      sink.push(summarizePublixSavingsBody({ status: response.status(), body }));
    } catch {
      // A savings summary must not fail the scrape.
    }
  });
}

function logPublixHarvestSummary(
  sectionLogs: readonly PublixSectionLog[],
  harvestCards: number,
  harvestOffers: number,
  savingsCalls: readonly PublixSavingsCallSummary[],
) {
  const totals = sectionLogs.reduce(
    (sum, line) => ({
      cards: sum.cards + line.cards,
      offers: sum.offers + line.offers,
      polls: sum.polls + line.polls,
      waitMs: sum.waitMs + line.waitMs,
    }),
    { cards: 0, offers: 0, polls: 0, waitMs: 0 },
  );
  logPublixLine(
    formatPublixHarvestSummaryLine({
      sections: sectionLogs.length,
      cards: totals.cards,
      offers: totals.offers,
      polls: totals.polls,
      waitMs: totals.waitMs,
      harvestCards,
      harvestOffers,
      savings: savingsCalls.at(-1) ?? null,
    }),
  );
}

function attachPublixResponseStatuses(
  page: import("playwright").Page,
  statuses: PublixResponseStatus[],
) {
  page.on("response", (response) => {
    const url = response.url();
    if (!publixResponseStatusIsRelevant(url) || statuses.length >= 40) {
      return;
    }
    const next = publixResponseStatusForCapture({ status: response.status(), url });
    if (statuses.some((item) => item.status === next.status && item.url === next.url)) {
      return;
    }
    statuses.push(next);
  });
}

function savePublixThinCapture(input: {
  html: string;
  url: string;
  zipCode?: string;
  gotoStatus: number | null;
  extractedCount: number;
  parsedOfferCount: number;
  rememberedOfferCount: number | null;
  expectedCardCount: number | null;
  responses: readonly PublixResponseStatus[];
}) {
  const capturedAt = new Date().toISOString();
  const captureDir = join(
    process.cwd(),
    "captures",
    "weekly-ad",
    "publix-thin",
    capturedAt.replaceAll(":", "-"),
  );
  mkdirSync(captureDir, { recursive: true });
  writeFileSync(join(captureDir, "page.html"), input.html, "utf8");
  writeFileSync(
    join(captureDir, "meta.json"),
    JSON.stringify(
      buildPublixThinCaptureMeta({
        url: input.url,
        zipCode: input.zipCode,
        gotoStatus: input.gotoStatus,
        extractedCount: input.extractedCount,
        parsedOfferCount: input.parsedOfferCount,
        rememberedOfferCount: input.rememberedOfferCount,
        expectedCardCount: input.expectedCardCount,
        responses: input.responses,
        capturedAt,
      }),
      null,
      2,
    ),
    "utf8",
  );
}

async function explorePublixWeeklyAdCategories(
  page: import("playwright").Page,
  baseUrl: string,
  visitedUrls: string[],
  timeoutMs: number,
  settle: {
    rememberedOfferCount: number | null;
    maxWaitMs: number;
    scrollViewports: number;
    printedTotalIsFloor: boolean;
    sectionLogs: PublixSectionLog[];
  },
) {
  const base = new URL(baseUrl);
  const categoryBase = `${base.origin}/savings/weekly-ad`;

  for (const slug of PUBLIX_WEEKLY_AD_CATEGORY_SLUGS) {
    const categoryUrl = `${categoryBase}/${slug}`;
    if (visitedUrls.includes(categoryUrl)) {
      continue;
    }

    try {
      await page.goto(categoryUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      visitedUrls.push(page.url());
      await waitForPublixSavingsCards(page, timeoutMs);
      const sectionCards = new Map<string, string>();
      const measured = await settlePublixSavingsCardCount(page, {
        timeoutMs,
        rememberedOfferCount: settle.rememberedOfferCount,
        maxWaitMs: settle.maxWaitMs,
        scrollViewports: settle.scrollViewports,
        printedTotalIsFloor: settle.printedTotalIsFloor,
        collectedCards: sectionCards,
      });
      let offers = 0;
      try {
        offers = parsePublixWeeklyAd({
          html: publixCollectedCardsDocument(sectionCards.values()),
        }).length;
      } catch {
        offers = 0;
      }
      const line: PublixSectionLog = {
        section: slug,
        printed: measured.expectedCount,
        cards: measured.seenCount,
        offers,
        polls: measured.polls,
        waitMs: measured.waitMs,
        stop: measured.stop,
      };
      settle.sectionLogs.push(line);
      logPublixLine(formatPublixSectionLogLine(line));
    } catch {
      logPublixLine(`[publix] section=${slug} log-skipped`);
    }
  }

  const categoryLabels = ["Protein", "Meat", "Produce", "BOGO"];
  for (const label of categoryLabels) {
    const link = page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first();
    if ((await link.count()) === 0) {
      continue;
    }

    try {
      await link.click({ timeout: 5_000 });
      await waitForPublixSavingsCards(page, timeoutMs);
      await scrollPageForLazyContent(page);
      await page.waitForTimeout(2_500);
      if (!visitedUrls.includes(page.url())) {
        visitedUrls.push(page.url());
      }
    } catch {
      // Continue exploring other labels.
    }
  }
}
