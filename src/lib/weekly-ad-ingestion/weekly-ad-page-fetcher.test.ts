import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchWeeklyAdPageContent } from "@/lib/weekly-ad-ingestion/weekly-ad-page-fetcher";

describe("fetchWeeklyAdPageContent", () => {
  const fixtureHtml = readFileSync(
    join(
      process.cwd(),
      "src/lib/weekly-ad-ingestion/fixtures/kroger-weekly-ad-sample.html",
    ),
    "utf8",
  );

  it("uses HTTP when offer rows are already present", async () => {
    const result = await fetchWeeklyAdPageContent({
      url: "https://example.com/kroger-weekly-ad",
      fetchStrategy: "browser-fallback",
      deps: {
        fetchHttpHtml: async () => fixtureHtml,
        fetchBrowserHtml: async () => {
          throw new Error("browser should not run");
        },
      },
    });

    expect(result.method).toBe("http");
    expect(result.parsedOfferCount).toBeGreaterThan(0);
  });

  it("falls back to browser when HTTP HTML has no parseable offers", async () => {
    const result = await fetchWeeklyAdPageContent({
      url: "https://example.com/kroger-weekly-ad",
      fetchStrategy: "browser-fallback",
      deps: {
        fetchHttpHtml: async () => "<html><body>Loading weekly ad...</body></html>",
        fetchBrowserHtml: async () => ({
          html: fixtureHtml,
          renderedWithBrowser: true,
          waitSelectorMatched: true,
        }),
      },
    });

    expect(result.method).toBe("browser");
    expect(result.parsedOfferCount).toBeGreaterThan(0);
  });

  it("respects YUM4LESS_WEEKLY_AD_NO_BROWSER and skips browser fallback", async () => {
    process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER = "1";

    const result = await fetchWeeklyAdPageContent({
      url: "https://example.com/kroger-weekly-ad",
      fetchStrategy: "browser-fallback",
      deps: {
        fetchHttpHtml: async () => "<html><body>Loading weekly ad...</body></html>",
        fetchBrowserHtml: async () => {
          throw new Error("browser should not run");
        },
      },
    });

    delete process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER;

    expect(result.method).toBe("http");
    expect(result.parsedOfferCount).toBe(0);
  });

  it("falls back to browser when HTTP throws (e.g. 403 WAF)", async () => {
    const result = await fetchWeeklyAdPageContent({
      url: "https://example.com/food-lion-weekly-ad",
      fetchStrategy: "browser-fallback",
      deps: {
        fetchHttpHtml: async () => {
          throw new Error("HTTP 403");
        },
        fetchBrowserHtml: async () => ({
          html: fixtureHtml,
          renderedWithBrowser: true,
          waitSelectorMatched: true,
        }),
      },
    });

    expect(result.method).toBe("browser");
    expect(result.parsedOfferCount).toBeGreaterThan(0);
  });

  it("rethrows HTTP errors when browser fallback is disabled", async () => {
    process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER = "1";

    await expect(
      fetchWeeklyAdPageContent({
        url: "https://example.com/food-lion-weekly-ad",
        fetchStrategy: "browser-fallback",
        deps: {
          fetchHttpHtml: async () => {
            throw new Error("HTTP 403");
          },
          fetchBrowserHtml: async () => ({
            html: fixtureHtml,
            renderedWithBrowser: true,
            waitSelectorMatched: true,
          }),
        },
      }),
    ).rejects.toThrow("HTTP 403");

    delete process.env.YUM4LESS_WEEKLY_AD_NO_BROWSER;
  });

  it("forces browser fetch when YUM4LESS_WEEKLY_AD_BROWSER is set", async () => {
    process.env.YUM4LESS_WEEKLY_AD_BROWSER = "1";

    const result = await fetchWeeklyAdPageContent({
      url: "https://example.com/kroger-weekly-ad",
      fetchStrategy: "http",
      deps: {
        fetchHttpHtml: async () => {
          throw new Error("http should not run");
        },
        fetchBrowserHtml: async () => ({
          html: fixtureHtml,
          renderedWithBrowser: true,
          waitSelectorMatched: true,
        }),
      },
    });

    delete process.env.YUM4LESS_WEEKLY_AD_BROWSER;

    expect(result.method).toBe("browser");
    expect(result.parsedOfferCount).toBeGreaterThan(0);
  });
});
