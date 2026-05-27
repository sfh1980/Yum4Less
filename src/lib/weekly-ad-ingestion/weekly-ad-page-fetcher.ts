import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import type { WeeklyAdFetchStrategy } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-config";
import { fetchWeeklyAdHtmlWithBrowser } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-fetcher";
import { fetchWeeklyAdHtmlOverHttp as fetchSharedWeeklyAdHtmlOverHttp } from "@/lib/weekly-ad-ingestion/weekly-ad-fetch-helpers";

export const HTTP_FETCH_TIMEOUT_MS = 12_000;

export type WeeklyAdPageFetchResult = {
  html: string;
  method: "http" | "browser";
  parsedOfferCount: number;
};

export type WeeklyAdPageFetcherDeps = {
  fetchHttpHtml?: typeof fetchWeeklyAdHtmlOverHttp;
  fetchBrowserHtml?: typeof fetchWeeklyAdHtmlWithBrowser;
};

export async function fetchWeeklyAdPageContent(input: {
  url: string;
  fetchStrategy: WeeklyAdFetchStrategy;
  browserWaitSelector?: string;
  deps?: WeeklyAdPageFetcherDeps;
}): Promise<WeeklyAdPageFetchResult> {
  const fetchHttp = input.deps?.fetchHttpHtml ?? fetchWeeklyAdHtmlOverHttp;
  const fetchBrowser = input.deps?.fetchBrowserHtml ?? fetchWeeklyAdHtmlWithBrowser;
  const browserDisabled = process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER === "1";
  const browserForced = process.env.YUM4LESS_WEEKLY_AD_BROWSER === "1";

  if (browserForced && !browserDisabled) {
    const browserResult = await fetchBrowser({
      url: input.url,
      waitSelector: input.browserWaitSelector,
    });
    return toFetchResult(browserResult.html, "browser");
  }

  if (input.fetchStrategy === "browser" && !browserDisabled) {
    const browserResult = await fetchBrowser({
      url: input.url,
      waitSelector: input.browserWaitSelector,
    });
    return toFetchResult(browserResult.html, "browser");
  }

  let httpHtml: string;
  try {
    httpHtml = await fetchHttp(input.url);
  } catch (httpError) {
    if (input.fetchStrategy !== "browser-fallback" || browserDisabled) {
      throw httpError;
    }

    const browserResult = await fetchBrowser({
      url: input.url,
      waitSelector: input.browserWaitSelector,
    });

    return toFetchResult(browserResult.html, "browser");
  }

  const httpOfferCount = parseWeeklyAdHtml(httpHtml).length;

  if (
    httpOfferCount > 0 ||
    input.fetchStrategy === "http" ||
    browserDisabled
  ) {
    return {
      html: httpHtml,
      method: "http",
      parsedOfferCount: httpOfferCount,
    };
  }

  const browserResult = await fetchBrowser({
    url: input.url,
    waitSelector: input.browserWaitSelector,
  });

  return toFetchResult(browserResult.html, "browser");
}

export async function fetchWeeklyAdHtmlOverHttp(url: string): Promise<string> {
  return fetchSharedWeeklyAdHtmlOverHttp({
    url,
    timeoutMs: HTTP_FETCH_TIMEOUT_MS,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Yum4LessWeeklyAdBot/0.1 (+local-mvp-ingestion)",
    },
  });
}

function toFetchResult(html: string, method: "http" | "browser"): WeeklyAdPageFetchResult {
  return {
    html,
    method,
    parsedOfferCount: parseWeeklyAdHtml(html).length,
  };
}
