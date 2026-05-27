import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";
import {
  appendEmbeddedWeeklyAdJson,
  attachWeeklyAdNetworkCapture,
  clickFirstMatchingSelector,
  fetchBrowserWithRetries,
  fetchWeeklyAdHtmlOverHttp,
  scrollPageForLazyContent,
} from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";

export const KROGER_BROWSER_FETCH_TIMEOUT_MS = 90_000;
export const KROGER_BROWSER_RETRY_COUNT = 2;

const KROGER_NETWORK_URL_PATTERN =
  /kroger|flipp|weekly|promo|offer|product|graphql|flyer|publication|wishabi/i;

const KROGER_WAIT_SELECTOR =
  "[data-testid*='weekly'], [data-testid*='Weekly'], [data-testid*='product-card'], .weekly-ad, #weekly-ad-offers-data, [data-weekly-ad-product], script#__NEXT_DATA__";

const KROGER_LAUNCH_ARGS = [
  "--disable-http2",
  "--disable-blink-features=AutomationControlled",
];

export type KrogerWeeklyAdFetchResult = {
  html: string;
  method: "http" | "browser";
  networkJsonBodies: string[];
  waitSelectorMatched: boolean;
  attempts: number;
  browserFailed?: boolean;
};

export type KrogerWeeklyAdFetcherDeps = {
  fetchHttpHtml?: (url: string) => Promise<string>;
  fetchBrowserPage?: (input: {
    url: string;
    waitSelector: string;
    timeoutMs: number;
  }) => Promise<{
    html: string;
    networkJsonBodies: string[];
    waitSelectorMatched: boolean;
  }>;
};

export async function fetchKrogerWeeklyAdPage(input: {
  url: string;
  deps?: KrogerWeeklyAdFetcherDeps;
}): Promise<KrogerWeeklyAdFetchResult> {
  const fetchHttp = input.deps?.fetchHttpHtml ?? fetchKrogerWeeklyAdHtmlOverHttp;
  const fetchBrowser = input.deps?.fetchBrowserPage ?? fetchKrogerWeeklyAdWithBrowser;
  const browserDisabled = process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER === "1";

  if (!browserDisabled) {
    try {
      const browserResult = await fetchBrowserWithRetries(
        () =>
          fetchBrowser({
            url: input.url,
            waitSelector: KROGER_WAIT_SELECTOR,
            timeoutMs: KROGER_BROWSER_FETCH_TIMEOUT_MS,
          }),
        KROGER_BROWSER_RETRY_COUNT,
      );
      return {
        html: browserResult.html,
        method: "browser",
        networkJsonBodies: browserResult.networkJsonBodies,
        waitSelectorMatched: browserResult.waitSelectorMatched,
        attempts: browserResult.attempts,
      };
    } catch {
      const httpHtml = await fetchHttp(input.url);
      return {
        html: httpHtml,
        method: "http",
        networkJsonBodies: [],
        waitSelectorMatched: false,
        attempts: KROGER_BROWSER_RETRY_COUNT + 1,
        browserFailed: true,
      };
    }
  }

  const httpHtml = await fetchHttp(input.url);
  return {
    html: httpHtml,
    method: "http",
    networkJsonBodies: [],
    waitSelectorMatched: false,
    attempts: 1,
  };
}

export async function fetchKrogerWeeklyAdHtmlOverHttp(url: string): Promise<string> {
  return fetchWeeklyAdHtmlOverHttp({ url, timeoutMs: 15_000 });
}

export async function fetchKrogerWeeklyAdWithBrowser(input: {
  url: string;
  waitSelector: string;
  timeoutMs: number;
}): Promise<{
  html: string;
  networkJsonBodies: string[];
  waitSelectorMatched: boolean;
}> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    args: KROGER_LAUNCH_ARGS,
  });
  const networkJsonBodies: string[] = [];

  try {
    const context = await browser.newContext(getWeeklyAdBrowserContextOptions());
    const page = await context.newPage();
    page.setDefaultTimeout(input.timeoutMs);

    attachWeeklyAdNetworkCapture(page, networkJsonBodies, KROGER_NETWORK_URL_PATTERN, {
      allowGraphqlUrl: true,
    });

    await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs,
    });

    await clickFirstMatchingSelector(page, [
      "#onetrust-accept-btn-handler",
      'button:has-text("Accept All")',
      'button:has-text("Accept")',
    ]);
    await page.waitForTimeout(2_000);

    let waitSelectorMatched = false;
    try {
      await page.waitForSelector(input.waitSelector, {
        timeout: Math.min(input.timeoutMs, 20_000),
      });
      waitSelectorMatched = true;
    } catch {
      // Some Kroger pages never expose known selectors; still capture HTML/network.
    }

    try {
      await page.waitForLoadState("networkidle", {
        timeout: Math.min(input.timeoutMs, 15_000),
      });
    } catch {
      // Continue with partial hydration.
    }

    await scrollPageForLazyContent(page);
    await page.waitForTimeout(3_000);
    await appendEmbeddedWeeklyAdJson(page, networkJsonBodies);

    const initialState = await page.evaluate(() => {
      const state = (window as Window & { __INITIAL_STATE__?: unknown }).__INITIAL_STATE__;
      return state ? JSON.stringify(state) : null;
    });

    if (initialState) {
      networkJsonBodies.push(initialState);
    }

    return {
      html: await page.content(),
      networkJsonBodies,
      waitSelectorMatched,
    };
  } finally {
    await browser.close();
  }
}
