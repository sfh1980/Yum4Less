import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";
import {
  buildPublixThinCaptureMeta,
  decidePublixCardPoll,
  PUBLIX_CARD_POLL_MS,
  publixCardCountIsThin,
  readPublixCardMaxWaitMs,
} from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";
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
  gotoStatus: number | null;
}> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const networkJsonBodies: string[] = [];

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

    await explorePublixWeeklyAdCategories(page, input.url, visitedUrls, input.timeoutMs);
    const rememberedOfferCount = input.rememberedOfferCount ?? null;
    const maxWaitMs = input.maxWaitMs ?? readPublixCardMaxWaitMs();
    let savingsCardCount = await settlePublixSavingsCardCount(page, {
      timeoutMs: input.timeoutMs,
      rememberedOfferCount,
      maxWaitMs,
    });

    if (publixCardCountIsThin(savingsCardCount, rememberedOfferCount)) {
      const retryGoto = await page.goto(input.url, {
        waitUntil: "domcontentloaded",
        timeout: input.timeoutMs,
      });
      gotoStatus = retryGoto?.status() ?? gotoStatus;
      if (!visitedUrls.includes(page.url())) {
        visitedUrls.push(page.url());
      }
      await scrollPageForLazyContent(page);
      savingsCardCount = await settlePublixSavingsCardCount(page, {
        timeoutMs: input.timeoutMs,
        rememberedOfferCount,
        maxWaitMs,
      });
    }

    const html = await page.content();
    if (publixCardCountIsThin(savingsCardCount, rememberedOfferCount)) {
      savePublixThinCapture({
        html,
        url: input.url,
        zipCode: input.zipCode,
        gotoStatus,
        extractedCount: savingsCardCount,
        rememberedOfferCount,
      });
    }

    await appendEmbeddedWeeklyAdJson(page, networkJsonBodies);

    return {
      html,
      networkJsonBodies,
      waitSelectorMatched,
      visitedUrls,
      savingsCardCount,
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

async function countPublixSavingsCards(page: import("playwright").Page) {
  return page.locator(PUBLIX_SAVINGS_CARD_SELECTOR).count();
}

async function settlePublixSavingsCardCount(
  page: import("playwright").Page,
  input: {
    timeoutMs: number;
    rememberedOfferCount: number | null;
    maxWaitMs: number;
  },
) {
  await waitForPublixSavingsCards(page, input.timeoutMs);
  const started = Date.now();
  let previousCount: number | null = null;
  let samples = 0;
  let count = 0;

  while (true) {
    count = await countPublixSavingsCards(page);
    samples += 1;
    const decision = decidePublixCardPoll({
      previousCount,
      count,
      rememberedOfferCount: input.rememberedOfferCount,
      elapsedMs: Date.now() - started,
      maxWaitMs: input.maxWaitMs,
      samples,
    });
    if (decision !== "continue") {
      return count;
    }
    previousCount = count;
    await page.waitForTimeout(PUBLIX_CARD_POLL_MS);
  }
}

function savePublixThinCapture(input: {
  html: string;
  url: string;
  zipCode?: string;
  gotoStatus: number | null;
  extractedCount: number;
  rememberedOfferCount: number | null;
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
        rememberedOfferCount: input.rememberedOfferCount,
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
      await scrollPageForLazyContent(page);
      await page.waitForTimeout(2_500);
    } catch {
      // Try the next category if one slug fails.
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
