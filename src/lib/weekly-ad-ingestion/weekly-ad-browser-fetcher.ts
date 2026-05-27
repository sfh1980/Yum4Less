import { parseWeeklyAdHtml } from "@/lib/weekly-ad-ingestion/parse-weekly-ad-html";
import { getWeeklyAdBrowserContextOptions } from "@/lib/weekly-ad-ingestion/weekly-ad-browser-profile";

export const BROWSER_FETCH_TIMEOUT_MS = 25_000;

const DEFAULT_WAIT_SELECTOR =
  "#weekly-ad-offers-data, [data-weekly-ad-product], script[type='application/json']";

export type WeeklyAdBrowserFetchResult = {
  html: string;
  renderedWithBrowser: true;
  waitSelectorMatched: boolean;
};

export async function fetchWeeklyAdHtmlWithBrowser(input: {
  url: string;
  waitSelector?: string;
  timeoutMs?: number;
}): Promise<WeeklyAdBrowserFetchResult> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const timeoutMs = input.timeoutMs ?? BROWSER_FETCH_TIMEOUT_MS;

  try {
    const context = await browser.newContext(getWeeklyAdBrowserContextOptions());
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    const waitSelector = input.waitSelector ?? DEFAULT_WAIT_SELECTOR;
    let waitSelectorMatched = false;

    try {
      await page.waitForSelector(waitSelector, {
        timeout: Math.min(timeoutMs, 12_000),
      });
      waitSelectorMatched = true;
    } catch {
      // Some retailer pages never expose our fixture selectors; still capture HTML.
    }

    const embeddedJson = await page.evaluate(() => {
      const script = document.getElementById("weekly-ad-offers-data");
      return script?.textContent?.trim() ?? null;
    });

    if (embeddedJson && parseWeeklyAdHtml(`<script id="weekly-ad-offers-data">${embeddedJson}</script>`).length > 0) {
      return {
        html: `<script type="application/json" id="weekly-ad-offers-data">${embeddedJson}</script>`,
        renderedWithBrowser: true,
        waitSelectorMatched: true,
      };
    }

    return {
      html: await page.content(),
      renderedWithBrowser: true,
      waitSelectorMatched,
    };
  } finally {
    await browser.close();
  }
}
