import { describe, expect, it, vi } from "vitest";
import * as flippFeed from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";

describe("flipp weekly ad resolver", () => {
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
});
