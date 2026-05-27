import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";
import {
  appendEmbeddedWeeklyAdJson,
  attachWeeklyAdNetworkCapture,
  clickFirstMatchingSelector,
  fetchBrowserWithRetries,
  fetchWeeklyAdHtmlOverHttp,
  scrollPageForLazyContent,
} from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";

export const WALMART_BROWSER_FETCH_TIMEOUT_MS = 90_000;
export const WALMART_BROWSER_RETRY_COUNT = 2;

const WALMART_NETWORK_URL_PATTERN =
  /walmart|flipp|weekly|promo|offer|product|graphql|flyer|publication|wishabi|circula/i;

const WALMART_WAIT_SELECTOR =
  "#weekly-ad-offers-data, [data-weekly-ad-product], [data-automation-id*='weekly'], [data-testid*='weekly'], script#__NEXT_DATA__";

const WALMART_LAUNCH_ARGS = [
  "--disable-http2",
  "--disable-blink-features=AutomationControlled",
];

export type WalmartWeeklyAdFetchResult = {
  html: string;
  method: "http" | "browser";
  networkJsonBodies: string[];
  waitSelectorMatched: boolean;
  attempts: number;
  browserFailed?: boolean;
};

export type WalmartWeeklyAdFetcherDeps = {
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

export async function fetchWalmartWeeklyAdPage(input: {
  url: string;
  deps?: WalmartWeeklyAdFetcherDeps;
}): Promise<WalmartWeeklyAdFetchResult> {
  const fetchHttp = input.deps?.fetchHttpHtml ?? fetchWalmartWeeklyAdHtmlOverHttp;
  const fetchBrowser = input.deps?.fetchBrowserPage ?? fetchWalmartWeeklyAdWithBrowser;
  const browserDisabled = process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER === "1";

  if (!browserDisabled) {
    try {
      const browserResult = await fetchBrowserWithRetries(
        () =>
          fetchBrowser({
            url: input.url,
            waitSelector: WALMART_WAIT_SELECTOR,
            timeoutMs: WALMART_BROWSER_FETCH_TIMEOUT_MS,
          }),
        WALMART_BROWSER_RETRY_COUNT,
      );
      return {
        html: browserResult.html,
        method: "browser",
        networkJsonBodies: browserResult.networkJsonBodies,
        waitSelectorMatched: browserResult.waitSelectorMatched,
        attempts: browserResult.attempts,
      };
    } catch {
      try {
        const httpHtml = await fetchHttp(input.url);
        return {
          html: httpHtml,
          method: "http",
          networkJsonBodies: [],
          waitSelectorMatched: false,
          attempts: WALMART_BROWSER_RETRY_COUNT + 1,
          browserFailed: true,
        };
      } catch {
        return {
          html: "",
          method: "http",
          networkJsonBodies: [],
          waitSelectorMatched: false,
          attempts: WALMART_BROWSER_RETRY_COUNT + 1,
          browserFailed: true,
        };
      }
    }
  }

  try {
    const httpHtml = await fetchHttp(input.url);
    return {
      html: httpHtml,
      method: "http",
      networkJsonBodies: [],
      waitSelectorMatched: false,
      attempts: 1,
    };
  } catch {
    return {
      html: "",
      method: "http",
      networkJsonBodies: [],
      waitSelectorMatched: false,
      attempts: 1,
      browserFailed: true,
    };
  }
}

export async function fetchWalmartWeeklyAdHtmlOverHttp(url: string): Promise<string> {
  return fetchWeeklyAdHtmlOverHttp({ url, timeoutMs: 15_000 });
}

export async function fetchWalmartWeeklyAdWithBrowser(input: {
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
    args: WALMART_LAUNCH_ARGS,
  });
  const networkJsonBodies: string[] = [];

  try {
    const context = await browser.newContext(getWeeklyAdBrowserContextOptions());
    const page = await context.newPage();
    page.setDefaultTimeout(input.timeoutMs);

    attachWeeklyAdNetworkCapture(page, networkJsonBodies, WALMART_NETWORK_URL_PATTERN, {
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
      'button:has-text("Continue")',
    ]);
    await page.waitForTimeout(2_000);

    let waitSelectorMatched = false;
    try {
      await page.waitForSelector(input.waitSelector, {
        timeout: Math.min(input.timeoutMs, 20_000),
      });
      waitSelectorMatched = true;
    } catch {
      // Continue with partial hydration.
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

    const nextData = await page.evaluate(() => {
      const script = document.getElementById("__NEXT_DATA__");
      return script?.textContent?.trim() ?? null;
    });
    if (nextData) {
      networkJsonBodies.push(nextData);
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
