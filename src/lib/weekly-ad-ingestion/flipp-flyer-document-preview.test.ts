import { describe, expect, it, vi } from "vitest";
import {
  flippFlyerDocumentLogEnabled,
  logFlippFlyerDocumentPreview,
} from "@/lib/weekly-ad-ingestion/flipp-flyer-document-preview";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";

const NOW = new Date("2026-11-04T15:00:00Z");

function flyer(input: {
  id: number;
  merchant: string;
  categories: string[];
  validFrom: string;
  validTo: string;
}) {
  return {
    id: input.id,
    merchant: input.merchant,
    name: "Weekly Ad",
    categories: input.categories,
    valid_from: input.validFrom,
    valid_to: input.validTo,
  };
}

describe("flipp flyer document log switch", () => {
  it("stays off unless the setting is 1", () => {
    expect(flippFlyerDocumentLogEnabled(buildTestProcessEnv())).toBe(false);
    expect(
      flippFlyerDocumentLogEnabled(
        buildTestProcessEnv({ YUM4LESS_FLIPP_FLYER_DOCUMENT_LOG: "1" }),
      ),
    ).toBe(true);
  });
});

describe("logFlippFlyerDocumentPreview", () => {
  it("fetches each grocery document once and does not call item search", async () => {
    const requested: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.includes("/flipp/flyers?")) {
        const postal = new URL(url).searchParams.get("postal_code");
        const flyers =
          postal === "28269"
            ? [
                flyer({
                  id: 8208783,
                  merchant: "Kroger",
                  categories: ["Groceries"],
                  validFrom: "2026-11-04T00:00:00-05:00",
                  validTo: "2026-11-10T23:59:59-05:00",
                }),
              ]
            : [
                flyer({
                  id: 8208783,
                  merchant: "Kroger",
                  categories: ["Groceries"],
                  validFrom: "2026-11-04T00:00:00-05:00",
                  validTo: "2026-11-10T23:59:59-05:00",
                }),
                flyer({
                  id: 8191621,
                  merchant: "Kroger",
                  categories: ["Electronics"],
                  validFrom: "2026-11-04T00:00:00-05:00",
                  validTo: "2026-11-10T23:59:59-05:00",
                }),
              ];
        return new Response(JSON.stringify({ flyers }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 1,
              flyer_id: 8208783,
              name: "Boneless Chuck Roast",
              price: "7.99",
              valid_from: "2026-11-04T00:00:00-05:00",
              valid_to: "2026-11-10T23:59:59-05:00",
            },
            {
              id: 2,
              flyer_id: 8208783,
              name: "Gift card",
              price: "",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const lines = await logFlippFlyerDocumentPreview({
      zipCodes: ["23005", "28269"],
      fetchImpl,
      now: NOW,
      log: () => undefined,
    });

    expect(requested.some((url) => url.includes("/items/search"))).toBe(false);
    expect(requested.filter((url) => url.includes("/flipp/flyers/8208783"))).toHaveLength(1);
    expect(requested.some((url) => url.includes("/flipp/flyers/8191621"))).toBe(false);
    expect(lines[0]).toContain("lists=2 distinctFlyers=2");
    const grocery = lines.find((line) => line.includes("id=8208783"));
    expect(grocery).toContain("decision=grocery");
    expect(grocery).toContain("items=2");
    expect(grocery).toContain("priced=1");
    expect(grocery).toContain("zips=23005,28269");
    const merchandise = lines.find((line) => line.includes("id=8191621"));
    expect(merchandise).toContain("decision=general-merchandise");
    expect(merchandise).toContain("crossCheck=not-fetched");
    expect(merchandise).toContain("zips=23005");
  });
});
