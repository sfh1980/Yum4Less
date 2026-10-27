import { describe, expect, it } from "vitest";
import {
  buildFlippWeeklyAdSearchUrl,
  clearFlippWeeklyAdFetchCache,
  fetchFlippSearchOffersForMerchant,
  fetchFlippWeeklyAdOffersForMerchantFlyers,
  fetchFlippWeeklyAdOffersForSearchTerms,
  parseFlippWeeklyAdItems,
  parseFlippWeeklyAdItemsForMerchant,
  selectFlyersForWeeklyAdPersist,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";

describe("flipp-weekly-ad-feed", () => {
  it("builds a merchant-scoped Flipp search URL", () => {
    expect(
      buildFlippWeeklyAdSearchUrl({ zipCode: "23111", merchantName: "Kroger" }),
    ).toBe(
      "https://backflipp.wishabi.com/flipp/items/search?locale=en-us&postal_code=23111&q=Kroger",
    );
    expect(
      buildFlippWeeklyAdSearchUrl({
        zipCode: "23111",
        flyerId: 7941582,
      }),
    ).toBe(
      "https://backflipp.wishabi.com/flipp/items/search?locale=en-us&postal_code=23111&flyer_id=7941582",
    );
  });

  it("parses priced Flipp weekly-ad items with directional labels", () => {
    const offers = parseFlippWeeklyAdItems([
      {
        name: "Boneless Strip Steaks",
        current_price: 9.99,
        original_price: 12.99,
        post_price_text: "/lb With Card & Digital Coupon",
        sale_story: "-3.00 /LB",
        valid_to: "2026-05-27T03:59:59+00:00",
        merchant_name: "Kroger",
      },
      {
        name: "Pork Back Ribs",
        current_price: null,
        original_price: null,
      },
      {
        name: "Strawberries",
        current_price: 4,
        pre_price_text: "2/",
        post_price_text: "With Card",
        valid_to: "2026-05-27T03:59:59+00:00",
        merchant_name: "Kroger",
      },
    ]);

    expect(offers).toEqual([
      expect.objectContaining({
        productName: "Boneless Strip Steaks",
        price: 9.99,
        saleLabel: expect.stringContaining("syndicated feed"),
      }),
      expect.objectContaining({
        productName: "Strawberries",
        price: 4,
        saleLabel: expect.stringContaining("2/ With Card"),
      }),
    ]);
  });

  it("builds Aldi and Food Lion merchant search URLs", () => {
    expect(
      buildFlippWeeklyAdSearchUrl({ zipCode: "23111", merchantName: "ALDI" }),
    ).toBe(
      "https://backflipp.wishabi.com/flipp/items/search?locale=en-us&postal_code=23111&q=ALDI",
    );
    expect(
      buildFlippWeeklyAdSearchUrl({ zipCode: "23111", merchantName: "Food Lion" }),
    ).toBe(
      "https://backflipp.wishabi.com/flipp/items/search?locale=en-us&postal_code=23111&q=Food+Lion",
    );
  });

  it("filters Flipp search results to the requested merchant", async () => {
    const offers = await fetchFlippSearchOffersForMerchant({
      zipCode: "23111",
      merchantName: "ALDI",
      fetchImpl: async () =>
        ({
          ok: true,
          json: async () => ({
            items: [
              {
                name: "Fresh Chicken Thighs",
                current_price: 2.49,
                merchant_name: "ALDI",
              },
              {
                name: "Unrelated Kroger Item",
                current_price: 3.99,
                merchant_name: "Kroger",
              },
            ],
          }),
        }) as Response,
    });

    expect(offers).toEqual([
      expect.objectContaining({
        productName: "Fresh Chicken Thighs",
        price: 2.49,
      }),
    ]);
  });

  it("prefers grocery-tagged flyers and drops apparel/electronics flyers", () => {
    const selected = selectFlyersForWeeklyAdPersist([
      {
        id: 1,
        merchant: "Walmart",
        name: "Weekly Grocery Ad",
        categories: ["Grocery"],
      },
      {
        id: 2,
        merchant: "Walmart",
        name: "Electronics Sale",
        categories: ["Electronics"],
      },
      {
        id: 3,
        merchant: "Walmart",
        name: "Apparel",
        categories_csv: "clothing,fashion",
      },
    ]);

    expect(selected).toEqual([
      expect.objectContaining({ id: 1, name: "Weekly Grocery Ad" }),
    ]);
  });

  it("keeps untagged grocery-chain flyers when no grocery category exists", () => {
    const selected = selectFlyersForWeeklyAdPersist([
      { id: 10, merchant: "ALDI", name: "ALDI Weekly Ad" },
      { id: 11, merchant: "ALDI", name: "Pharmacy", categories: ["pharmacy"] },
    ]);

    expect(selected).toEqual([expect.objectContaining({ id: 10 })]);
  });

  it("drops Dollar General general-merchandise Flipp lines when Food is tagged", () => {
    const offers = parseFlippWeeklyAdItemsForMerchant(
      [
        {
          name: "Clover Valley Spaghetti",
          current_price: 1,
          merchant_name: "Dollar General",
          _L1: "Food, Beverages & Tobacco",
        },
        {
          name: "LEGO Classic Bricks",
          current_price: 12.99,
          merchant_name: "Dollar General",
          _L1: "Toys & Games",
        },
      ],
      "Dollar General",
    );

    expect(offers.map((offer) => offer.productName)).toEqual([
      "Clover Valley Spaghetti",
    ]);
  });

  it("fetches one item list when two ZIPs return the same flyer id", async () => {
    clearFlippWeeklyAdFetchCache();
    const counts = { lists: 0, items: 0 };
    const fetchImpl = flippFetch((url) => {
      if (url.includes("/flipp/flyers")) {
        counts.lists += 1;
        return { flyers: [{ id: 42, merchant: "ALDI", categories: ["Grocery"] }] };
      }
      if (url.includes("flyer_id=42")) {
        counts.items += 1;
        return {
          items: [{ name: "Milk", current_price: 1.29, merchant_name: "ALDI" }],
        };
      }
      throw new Error(url);
    });

    const first = await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: "23005",
      merchantName: "ALDI",
      fetchImpl,
    });
    const second = await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: "28269",
      merchantName: "ALDI",
      fetchImpl,
    });

    expect(counts.lists).toBe(2);
    expect(counts.items).toBe(1);
    expect(first[0]?.flyerId).toBe(42);
    expect(second[0]?.flyerId).toBe(42);
  });

  it("fetches two item lists when the flyer ids differ", async () => {
    clearFlippWeeklyAdFetchCache();
    const counts = { lists: 0, items: 0 };
    const fetchImpl = flippFetch((url) => {
      if (url.includes("/flipp/flyers")) {
        counts.lists += 1;
        const postal = new URL(url).searchParams.get("postal_code");
        const id = postal === "23005" ? 42 : 77;
        return { flyers: [{ id, merchant: "ALDI", categories: ["Grocery"] }] };
      }
      if (url.includes("flyer_id=")) {
        counts.items += 1;
        return {
          items: [{ name: "Milk", current_price: 1.29, merchant_name: "ALDI" }],
        };
      }
      throw new Error(url);
    });

    await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: "23005",
      merchantName: "ALDI",
      fetchImpl,
    });
    await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: "28269",
      merchantName: "ALDI",
      fetchImpl,
    });

    expect(counts.lists).toBe(2);
    expect(counts.items).toBe(2);
  });

  it("fetches one flyer list when two merchants share a ZIP", async () => {
    clearFlippWeeklyAdFetchCache();
    const counts = { lists: 0, items: 0 };
    const fetchImpl = flippFetch((url) => {
      if (url.includes("/flipp/flyers")) {
        counts.lists += 1;
        return {
          flyers: [
            { id: 1, merchant: "ALDI", categories: ["Grocery"] },
            { id: 2, merchant: "Lidl", categories: ["Grocery"] },
          ],
        };
      }
      if (url.includes("flyer_id=")) {
        counts.items += 1;
        const id = new URL(url).searchParams.get("flyer_id");
        return {
          items: [
            {
              name: id === "1" ? "Aldi Milk" : "Lidl Milk",
              current_price: 1,
              merchant_name: id === "1" ? "ALDI" : "Lidl",
            },
          ],
        };
      }
      throw new Error(url);
    });

    await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: "23005",
      merchantName: "ALDI",
      fetchImpl,
    });
    await fetchFlippWeeklyAdOffersForMerchantFlyers({
      zipCode: "23005",
      merchantName: "Lidl",
      fetchImpl,
    });

    expect(counts.lists).toBe(1);
    expect(counts.items).toBe(2);
  });

  it("searches a supplemental term once when two ZIPs ask for it", async () => {
    clearFlippWeeklyAdFetchCache();
    let searches = 0;
    const fetchImpl = flippFetch((url) => {
      if (url.includes("q=")) {
        searches += 1;
        return {
          items: [{ name: "Fresh Lemon", current_price: 0.99, merchant_name: "ALDI" }],
        };
      }
      throw new Error(url);
    });

    await fetchFlippWeeklyAdOffersForSearchTerms({
      zipCode: "23005",
      merchantName: "ALDI",
      searchTerms: ["Lemon"],
      fetchImpl,
    });
    await fetchFlippWeeklyAdOffersForSearchTerms({
      zipCode: "28269",
      merchantName: "ALDI",
      searchTerms: ["Lemon"],
      fetchImpl,
    });

    expect(searches).toBe(1);
  });
});

function flippFetch(respond: (url: string) => unknown): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    return {
      ok: true,
      status: 200,
      json: async () => respond(String(input)),
    } as Response;
  }) as typeof fetch;
}
