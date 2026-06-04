import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchBrowserWithRetries<TResult extends Record<string, unknown>>(
  fetchBrowser: () => Promise<TResult>,
  retryCount: number,
): Promise<TResult & { attempts: number }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const result = await fetchBrowser();
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        await sleep(1_500 * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Weekly-ad browser fetch failed after retries.");
}

export async function fetchWithRetries(
  fetchRequest: () => Promise<Response>,
  options: {
    retryCount?: number;
    backoffMs?: number;
    shouldRetryStatus?: (status: number) => boolean;
  } = {},
): Promise<Response> {
  const retryCount = options.retryCount ?? getConfiguredRetryCount();
  const backoffMs = options.backoffMs ?? getConfiguredBackoffMs();
  const shouldRetryStatus =
    options.shouldRetryStatus ??
    ((status: number) => status === 429 || (status >= 500 && status <= 504));
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetchRequest();
      if (!shouldRetryStatus(response.status) || attempt >= retryCount) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt >= retryCount) {
        break;
      }
    }

    await sleep(backoffMs * attempt);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Weekly-ad fetch failed after retries.");
}

function getConfiguredRetryCount() {
  const configured = Number(process.env.YUM4LESS_WEEKLY_AD_HTTP_RETRIES);
  return Number.isInteger(configured) && configured > 0 && configured <= 5
    ? configured
    : 3;
}

function getConfiguredBackoffMs() {
  const configured = Number(process.env.YUM4LESS_WEEKLY_AD_BACKOFF_MS);
  return Number.isInteger(configured) && configured >= 100 && configured <= 10_000
    ? configured
    : 1_000;
}

export async function fetchWeeklyAdHtmlOverHttp(input: {
  url: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
}): Promise<string> {
  const timeoutMs = input.timeoutMs ?? 15_000;

  const response = await fetchWithRetries(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input.url, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": getWeeklyAdBrowserContextOptions().userAgent,
          ...input.headers,
        },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

export async function scrollPageForLazyContent(page: import("playwright").Page) {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight, 400);
    const maxScroll = Math.min(document.body.scrollHeight, step * 8);
    for (let position = 0; position < maxScroll; position += step) {
      window.scrollTo(0, position);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    window.scrollTo(0, 0);
  });
}

export function attachWeeklyAdNetworkCapture(
  page: import("playwright").Page,
  networkJsonBodies: string[],
  urlPattern: RegExp,
  options?: {
    allowGraphqlUrl?: boolean;
    allowServicesDomain?: boolean;
    requireJsonPrefix?: boolean;
  },
) {
  page.on("response", async (response) => {
    const responseUrl = response.url();
    if (!urlPattern.test(responseUrl)) {
      return;
    }

    try {
      const contentType = response.headers()["content-type"] ?? "";
      const isJsonLike =
        contentType.includes("json") ||
        (options?.allowGraphqlUrl && responseUrl.includes("graphql")) ||
        (options?.allowServicesDomain && responseUrl.includes("services.publix.com"));

      if (!isJsonLike) {
        return;
      }

      const body = await response.text();
      if (body.length < 40 || body.length > 2_000_000) {
        return;
      }

      if (options?.requireJsonPrefix && !body.startsWith("{") && !body.startsWith("[")) {
        return;
      }

      networkJsonBodies.push(body);
    } catch {
      // Ignore unreadable network payloads.
    }
  });
}

export async function appendEmbeddedWeeklyAdJson(
  page: import("playwright").Page,
  networkJsonBodies: string[],
) {
  const embeddedJson = await page.evaluate(() => {
    const script = document.getElementById("weekly-ad-offers-data");
    return script?.textContent?.trim() ?? null;
  });

  if (embeddedJson) {
    networkJsonBodies.push(embeddedJson);
  }
}

export async function clickFirstMatchingSelector(
  page: import("playwright").Page,
  selectors: string[],
) {
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if ((await button.count()) > 0) {
        await button.click({ timeout: 3_000 });
        return;
      }
    } catch {
      // Try the next selector.
    }
  }
}
