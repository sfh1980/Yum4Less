import { afterEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import * as flippFeed from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import {
  buildSupplementalFlippSearchTermsForIngredients,
  FLIPP_SUPPLEMENTAL_MAX_SEARCH_TERMS,
  resolveFlippWeeklyAdOffersForChain,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";

describe("buildSupplementalFlippSearchTermsForIngredients", () => {
  it("uses one primary term per unmatched ingredient and caps lookups", () => {
    const broccoliOnly = buildSupplementalFlippSearchTermsForIngredients([
      "broccoli",
      "lemon",
      "olive-oil",
    ]);

    expect(broccoliOnly).toEqual(
      expect.arrayContaining(["Broccoli", "Lemon", "Olive oil"]),
    );
    expect(broccoliOnly.length).toBe(3);

    const capped = buildSupplementalFlippSearchTermsForIngredients([
      ...INTERNAL_CATALOG_INGREDIENT_IDS,
      ...INTERNAL_CATALOG_INGREDIENT_IDS,
    ]);

    expect(capped.length).toBe(FLIPP_SUPPLEMENTAL_MAX_SEARCH_TERMS);
  });
});

describe("flipp weekly ad resolver", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges merchant, flyer, and ingredient-search offers for Kroger", async () => {
    vi.spyOn(flippFeed, "readFlippMerchantSearch").mockResolvedValue({
      offers: [{ productName: "Kroger Fresh Chicken Thighs Family Pack", price: 5.79 }],
      provedEmpty: false,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippMerchantFlyers").mockResolvedValue({
      offers: [{ productName: "Kroger Black Beans 15 oz", price: 0.99 }],
      provedEmpty: false,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippSupplementalSearches").mockResolvedValue({
      offers: [{ productName: "Kroger 80% Lean Ground Beef, 3 lb", price: 17.97 }],
      provedEmpty: false,
      requestFailed: false,
    });

    const result = await resolveFlippWeeklyAdOffersForChain({
      chain: "kroger",
      zipCode: "23111",
      merchantName: "Kroger",
      trackedIngredientIds: ["ground-beef"],
    });

    expect(result.rawOffers.length).toBeGreaterThanOrEqual(2);
    expect(result.retrievalLabel).toContain("Flipp");
    expect(result.retrievalLabel).toContain("ingredient searches");
  });

  it("merges merchant, flyer, and ingredient-search offers for Food Lion", async () => {
    vi.spyOn(flippFeed, "readFlippMerchantSearch").mockResolvedValue({
      offers: [{ productName: "Corn on the Cob", price: 1 }],
      provedEmpty: false,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippMerchantFlyers").mockResolvedValue({
      offers: [{ productName: "Mini Cucumbers", price: 1.99 }],
      provedEmpty: false,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippSupplementalSearches").mockResolvedValue({
      offers: [{ productName: "Fresh Broccoli Crowns", price: 2.49 }],
      provedEmpty: false,
      requestFailed: false,
    });

    const result = await resolveFlippWeeklyAdOffersForChain({
      chain: "food-lion",
      zipCode: "23111",
      merchantName: "Food Lion",
      trackedIngredientIds: ["broccoli"],
    });

    expect(result.rawOffers.length).toBeGreaterThanOrEqual(2);
    expect(result.retrievalLabel).toContain("Flipp");
    expect(result.retrievalLabel).toContain("ingredient searches");
  });

  it("searches only unmatched tracked ingredients when bulk feed partially matches", async () => {
    vi.spyOn(flippFeed, "readFlippMerchantSearch").mockResolvedValue({
      offers: [{ productName: "BROCCOLI CROWNS", price: 1.79 }],
      provedEmpty: false,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippMerchantFlyers").mockResolvedValue({
      offers: [],
      provedEmpty: true,
      requestFailed: false,
    });
    const searchSpy = vi
      .spyOn(flippFeed, "readFlippSupplementalSearches")
      .mockResolvedValue({
        offers: [{ productName: "Fresh Lemons 2 lb Bag", price: 2.49 }],
        provedEmpty: false,
        requestFailed: false,
      });

    await resolveFlippWeeklyAdOffersForChain({
      chain: "aldi",
      zipCode: "23111",
      merchantName: "ALDI",
      trackedIngredientIds: ["broccoli", "lemon"],
    });

    expect(searchSpy).toHaveBeenCalledOnce();
    const searchTerms = searchSpy.mock.calls[0]![0].searchTerms;
    expect(searchTerms).toEqual(["Lemon"]);
    expect(searchTerms).not.toContain("Broccoli");
  });

  it("marks no current flyer only when every read proved empty", async () => {
    vi.spyOn(flippFeed, "readFlippMerchantSearch").mockResolvedValue({
      offers: [],
      provedEmpty: true,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippMerchantFlyers").mockResolvedValue({
      offers: [],
      provedEmpty: true,
      requestFailed: false,
    });
    vi.spyOn(flippFeed, "readFlippSupplementalSearches").mockResolvedValue({
      offers: [],
      provedEmpty: true,
      requestFailed: false,
    });

    const result = await resolveFlippWeeklyAdOffersForChain({
      chain: "food-lion",
      zipCode: "23005",
      merchantName: "Food Lion",
      trackedIngredientIds: ["bananas"],
    });

    expect(result.rawOffers).toEqual([]);
    expect(result.noCurrentFlyer).toBe(true);
  });

  it("does not mark no current flyer when a read failed or returned an unexpected body", async () => {
    vi.spyOn(flippFeed, "readFlippMerchantSearch").mockResolvedValue({
      offers: [],
      provedEmpty: false,
      requestFailed: true,
    });
    vi.spyOn(flippFeed, "readFlippMerchantFlyers").mockResolvedValue({
      offers: [],
      provedEmpty: true,
      requestFailed: false,
    });

    const failed = await resolveFlippWeeklyAdOffersForChain({
      chain: "food-lion",
      zipCode: "23005",
      merchantName: "Food Lion",
      trackedIngredientIds: [],
    });
    expect(failed.noCurrentFlyer).toBe(false);

    vi.spyOn(flippFeed, "readFlippMerchantSearch").mockRejectedValue(
      new Error("Flipp weekly-ad search for Food Lion failed with HTTP 500"),
    );
    await expect(
      resolveFlippWeeklyAdOffersForChain({
        chain: "food-lion",
        zipCode: "23005",
        merchantName: "Food Lion",
        trackedIngredientIds: [],
      }),
    ).rejects.toThrow(/HTTP 500/);
  });
});
