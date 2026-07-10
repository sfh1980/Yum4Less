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
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([
      { productName: "Kroger Fresh Chicken Thighs Family Pack", price: 5.79 },
    ]);
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForMerchantFlyers").mockResolvedValue([
      { productName: "Kroger Black Beans 15 oz", price: 0.99 },
    ]);
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForSearchTerms").mockResolvedValue([
      { productName: "Kroger 80% Lean Ground Beef, 3 lb", price: 17.97 },
    ]);

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
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([
      { productName: "Corn on the Cob", price: 1 },
    ]);
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForMerchantFlyers").mockResolvedValue([
      { productName: "Mini Cucumbers", price: 1.99 },
    ]);
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForSearchTerms").mockResolvedValue([
      { productName: "Fresh Broccoli Crowns", price: 2.49 },
    ]);

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
    vi.spyOn(flippFeed, "fetchFlippSearchOffersForMerchant").mockResolvedValue([
      { productName: "BROCCOLI CROWNS", price: 1.79 },
    ]);
    vi.spyOn(flippFeed, "fetchFlippWeeklyAdOffersForMerchantFlyers").mockResolvedValue([]);
    const searchSpy = vi
      .spyOn(flippFeed, "fetchFlippWeeklyAdOffersForSearchTerms")
      .mockResolvedValue([{ productName: "Fresh Lemons 2 lb Bag", price: 2.49 }]);

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
});
