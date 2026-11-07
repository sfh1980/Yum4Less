import { describe, expect, it } from "vitest";
import {
  choosePublixFlippFlyerId,
  loadPublixFlippFlyerOffers,
  publixFlyersEligibleForDocument,
} from "@/lib/weekly-ad-ingestion/publix-flipp-flyer-fallback";
import { parseFlippFlyerDocument } from "@/lib/weekly-ad-ingestion/flipp-flyer-document";
import type { FlippFlyerDocument } from "@/lib/weekly-ad-ingestion/flipp-flyer-document";

/**
 * Two items copied from
 * captures/flipp-doc-overlap/2026-11-04T02-16-27-499Z/8205499.json.
 * That document has 348 items and 163 non-blank prices. The capture stays untracked.
 */
const PUBLIX_8205499_EXCERPT: FlippFlyerDocument = {
  items: [
    {
      id: 1049818732,
      flyer_id: 8205499,
      name: "Red Baron French Bread or Deep Dish Pizza",
      brand: "Red Baron",
      price: "10.0",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
    },
    {
      id: 1049817934,
      name: "Nestlé Toll House Cookie Dough BOGO*",
      price: "",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function groceryDocument(itemCount: number): FlippFlyerDocument {
  return {
    items: Array.from({ length: itemCount }, (_, index) => ({
      name: `Grocery item ${index}`,
      price: "1.29",
      valid_from: "2026-11-05T00:00:00-05:00",
      valid_to: "2026-11-11T23:59:59-05:00",
    })),
  };
}

describe("Publix Flipp flyer fallback", () => {
  it("parses the saved Publix excerpt and skips the unpriced item", () => {
    const offers = parseFlippFlyerDocument(PUBLIX_8205499_EXCERPT);
    expect(offers).toEqual([
      expect.objectContaining({
        productName: "Red Baron French Bread or Deep Dish Pizza",
        price: 10,
        brand: "Red Baron",
        validFrom: "2026-10-28T00:00:00-04:00",
        validTo: "2026-11-03T23:59:59-05:00",
      }),
    ]);
  });

  it("picks the ZIP-list flyer with the most items at or above 100", () => {
    expect(
      choosePublixFlippFlyerId([
        { flyerId: 11, itemCount: 48 },
        { flyerId: 22, itemCount: 348 },
        { flyerId: 33, itemCount: 120 },
      ]),
    ).toBe(22);
    expect(choosePublixFlippFlyerId([{ flyerId: 11, itemCount: 48 }])).toBeNull();
  });

  it("does not fetch a Charlotte-named flyer or a flyer absent from the ZIP list", async () => {
    const flyers = publixFlyersEligibleForDocument([
      { id: 22, merchant: "Publix", name: "Weekly Ad" },
      { id: 90, merchant: "Publix", name: "Publix Weekly Ad Charlotte" },
      { id: 91, merchant: "ALDI", name: "Weekly Ad" },
    ]);
    expect(flyers.map((flyer) => flyer.id)).toEqual([22]);

    const fetched: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const href = String(url);
      fetched.push(href);
      if (href.includes("/flipp/flyers?")) {
        return jsonResponse({
          flyers: [
            { id: 22, merchant: "Publix", name: "Weekly Ad" },
            { id: 90, merchant: "Publix", name: "Publix Weekly Ad Charlotte" },
            { id: 91, merchant: "ALDI", name: "ALDI Weekly Ad" },
          ],
        });
      }
      if (href.includes("/flipp/flyers/22?")) {
        return jsonResponse(groceryDocument(348));
      }
      throw new Error(`unexpected flyer fetch ${href}`);
    }) as typeof fetch;

    const loaded = await loadPublixFlippFlyerOffers({
      zipCode: "23005",
      fetchImpl,
    });

    expect(loaded.flyerId).toBe(22);
    expect(loaded.itemCount).toBe(348);
    expect(loaded.offers).toHaveLength(348);
    expect(loaded.offers[0]?.saleLabel).toBe("Flipp flyer");
    expect(loaded.offers[0]?.validFrom).toBe("2026-11-05T00:00:00-05:00");
    expect(loaded.offers[0]?.validThrough).toBe("2026-11-11T23:59:59-05:00");
    expect(fetched.some((href) => href.includes("/flipp/flyers/90"))).toBe(false);
    expect(fetched.some((href) => href.includes("postal_code=23005"))).toBe(true);
  });
});
