import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchKrogerWeeklyAdPage } from "@/lib/weekly-ad-ingestion/kroger-weekly-ad-fetcher";

describe("fetchKrogerWeeklyAdPage", () => {
  const fixtureHtml = readFileSync(
    join(
      process.cwd(),
      "src/lib/weekly-ad-ingestion/fixtures/kroger-weekly-ad-sample.html",
    ),
    "utf8",
  );

  it("uses the browser fetcher by default and returns network payloads", async () => {
    const result = await fetchKrogerWeeklyAdPage({
      url: "https://www.kroger.com/weeklyad?zipcode=23111",
      deps: {
        fetchHttpHtml: async () => {
          throw new Error("http should not run");
        },
        fetchBrowserPage: async () => ({
          html: fixtureHtml,
          networkJsonBodies: ['{"data":[{"description":"Test","items":[{"price":{"promo":1.99}}]}]}'],
          waitSelectorMatched: true,
        }),
      },
    });

    expect(result.method).toBe("browser");
    expect(result.networkJsonBodies).toHaveLength(1);
    expect(result.attempts).toBe(1);
  });

  it("retries browser fetch and falls back to HTTP when browser fails", async () => {
    let attempts = 0;

    const result = await fetchKrogerWeeklyAdPage({
      url: "https://www.kroger.com/weeklyad?zipcode=23111",
      deps: {
        fetchBrowserPage: async () => {
          attempts += 1;
          throw new Error("blocked");
        },
        fetchHttpHtml: async () => fixtureHtml,
      },
    });

    expect(attempts).toBe(2);
    expect(result.method).toBe("http");
    expect(result.browserFailed).toBe(true);
    expect(result.html).toContain("weekly-ad-offers-data");
  });
});
