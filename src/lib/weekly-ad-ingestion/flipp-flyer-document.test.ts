import { describe, expect, it, vi } from "vitest";
import {
  ALDI_8206872,
  FOOD_LION_8195596,
  HARRIS_TEETER_8206061,
  KROGER_8208783,
  KROGER_COMMON_8191621,
  LIDL_8193559,
  PUBLIX_8205499,
  WALMART_8210320,
} from "@/lib/weekly-ad-ingestion/flipp-flyer-document-fixtures";
import {
  buildFlippFlyerDocumentUrl,
  classifyFlippFlyerDocument,
  fetchFlippFlyerDocument,
  parseFlippFlyerDocument,
  parseFlippFlyerDocumentPrice,
  type FlippFlyerDocument,
} from "@/lib/weekly-ad-ingestion/flipp-flyer-document";

const GROCERY_FIXTURES: Array<[string, FlippFlyerDocument]> = [
  ["Kroger 8208783", KROGER_8208783],
  ["Food Lion 8195596", FOOD_LION_8195596],
  ["ALDI 8206872", ALDI_8206872],
  ["Lidl 8193559", LIDL_8193559],
  ["Publix 8205499", PUBLIX_8205499],
  ["Harris Teeter 8206061", HARRIS_TEETER_8206061],
];

describe("Flipp flyer document URL", () => {
  it("requests the flyer document, not the item search", () => {
    expect(
      buildFlippFlyerDocumentUrl({ flyerId: 8208783, postalCode: "23005" }),
    ).toBe(
      "https://backflipp.wishabi.com/flipp/flyers/8208783?locale=en-us&postal_code=23005",
    );
  });
});

describe("Flipp flyer document parse", () => {
  it.each(GROCERY_FIXTURES)("keeps a priced line from %s", (_label, document) => {
    const offers = parseFlippFlyerDocument(document);
    expect(offers.length).toBeGreaterThan(0);
    const offer = offers[0]!;
    expect(offer.productName.length).toBeGreaterThan(0);
    expect(offer.price).toBeGreaterThan(0);
    expect(offer.validFrom).toMatch(/^2026-/);
    expect(offer.validTo).toMatch(/^2026-/);
    expect(offer.validThrough).toBe(offer.validTo);
    expect(offer.flyerId).toBe(document.items?.[0]?.flyer_id);
  });

  it("reads a decimal string price and the brand", () => {
    const offers = parseFlippFlyerDocument(ALDI_8206872);
    expect(offers[0]).toMatchObject({
      productName: "Fresh Family Pack Chicken Tenderloins",
      price: 2.09,
      validFrom: "2026-10-28T00:00:00-04:00",
      validTo: "2026-11-03T23:59:59-05:00",
    });
    expect(offers[1]).toMatchObject({
      productName: "Emporium Selection Aged Reserved White Cheddar",
      brand: "Emporium Selection",
      price: 2.69,
      saleLabel: "Emporium Selection",
    });
  });

  it("drops a blank price that is not a multi-buy", () => {
    const offers = parseFlippFlyerDocument(FOOD_LION_8195596);
    expect(offers.map((offer) => offer.productName)).not.toContain(
      "Entenmann's Little Bites Muffins",
    );
    expect(offers).toHaveLength(2);
  });

  it("turns a slash price and a for-price into a unit price", () => {
    expect(parseFlippFlyerDocumentPrice("2/$6")).toEqual({
      price: 3,
      multiBuyLabel: "2/$6",
    });
    expect(parseFlippFlyerDocumentPrice("3 for $6")).toEqual({
      price: 2,
      multiBuyLabel: "3 for $6",
    });
    expect(parseFlippFlyerDocumentPrice("")).toBeNull();
    expect(parseFlippFlyerDocumentPrice("5.99")).toEqual({
      price: 5.99,
    });
    const offers = parseFlippFlyerDocument({
      items: [
        {
          flyer_id: 1,
          name: "Yogurt",
          price: "2/$6",
          valid_from: "2026-11-05T00:00:00-05:00",
          valid_to: "2026-11-11T23:59:59-05:00",
        },
      ],
    });
    expect(offers[0]).toMatchObject({
      productName: "Yogurt",
      price: 3,
      saleLabel: "2/$6",
      validFrom: "2026-11-05T00:00:00-05:00",
    });
  });
});

describe("Flipp flyer document kind", () => {
  it.each(GROCERY_FIXTURES)(
    "uses name votes for %s when the list has no categories",
    (_label, document) => {
      const result = classifyFlippFlyerDocument({ document });
      expect(result.categoryKind).toBe("absent");
      expect(result.kind).toBe("grocery");
      expect(result.crossCheckAgrees).toBe(true);
    },
  );

  it("lets grocery categories win when the names vote general merchandise", () => {
    const result = classifyFlippFlyerDocument({
      document: WALMART_8210320,
      categories: ["Groceries"],
    });
    expect(result.categoryKind).toBe("grocery");
    expect(result.nameKind).toBe("general-merchandise");
    expect(result.kind).toBe("grocery");
    expect(result.crossCheckAgrees).toBe(false);
  });

  it("lets a merchandise category win when the names vote grocery", () => {
    const result = classifyFlippFlyerDocument({
      document: KROGER_8208783,
      categories: ["Electronics"],
    });
    expect(result.categoryKind).toBe("general-merchandise");
    expect(result.nameKind).toBe("grocery");
    expect(result.kind).toBe("general-merchandise");
    expect(result.crossCheckAgrees).toBe(false);
  });

  it("calls the Kroger common sample and the Walmart sample general merchandise from names", () => {
    expect(classifyFlippFlyerDocument({ document: KROGER_COMMON_8191621 }).kind).toBe(
      "general-merchandise",
    );
    expect(classifyFlippFlyerDocument({ document: WALMART_8210320 }).kind).toBe(
      "general-merchandise",
    );
  });
});

describe("fetchFlippFlyerDocument", () => {
  it("parses the document response and does not call item search", async () => {
    let requestedUrl = "";
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify(LIDL_8193559), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const result = await fetchFlippFlyerDocument({
      flyerId: 8193559,
      postalCode: "23005",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(requestedUrl).toContain("/flipp/flyers/8193559");
    expect(requestedUrl).not.toContain("/items/search");
    expect(result.classification.kind).toBe("grocery");
    expect(result.classification.categoryKind).toBe("absent");
    expect(result.offers[0]).toMatchObject({
      productName: "Honeycrisp apple",
      price: 1.79,
    });
  });
});
