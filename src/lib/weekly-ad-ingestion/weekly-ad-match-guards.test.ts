import { describe, expect, it } from "vitest";
import { MIN_WEEKLY_AD_MATCH_CONFIDENCE } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { probeWeeklyAdOfferMatch } from "@/lib/weekly-ad-ingestion/weekly-ad-match-funnel-analysis";
import { shouldRejectWeeklyAdIngredientMatch } from "@/lib/weekly-ad-ingestion/weekly-ad-match-guards";
import { WEEKLY_AD_TRACKED_INGREDIENT_IDS } from "@/lib/weekly-ad-ingestion/weekly-ad-fixture-ingest";

describe("weekly ad match guards — Aldi false-positive class", () => {
  const falsePositiveCases = [
    {
      ingredientId: "honey",
      productName: "Parkview Hot Honey or Nashville Hot Chicken Sausage",
    },
    {
      ingredientId: "honey",
      productName: "Benton's Honey Graham Crackers",
    },
    {
      ingredientId: "cheddar-cheese",
      productName: "Parkview Cheddar Brats",
    },
    {
      ingredientId: "cheddar-cheese",
      productName: "Kirkwood Turkey & Cheddar Smoked Sausage",
    },
    {
      ingredientId: "vanilla-extract",
      productName: "Sundae Shoppe Vanilla Bars or Crunch Bars",
    },
  ] as const;

  it.each(falsePositiveCases)(
    "rejects $productName as $ingredientId",
    ({ ingredientId, productName }) => {
      expect(
        shouldRejectWeeklyAdIngredientMatch({ ingredientId, productName }),
      ).toBe(true);
    },
  );

  it.each(falsePositiveCases)(
    "does not match $productName to tracked ingredients at weekly-ad threshold",
    ({ productName }) => {
      const probe = probeWeeklyAdOfferMatch({
        chain: "aldi",
        rawOffer: { productName, price: 2.99 },
        trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
      });

      expect(probe.matchedIngredientId).toBeUndefined();
      expect(probe.bestConfidence).toBeLessThan(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    },
  );

  const legitimateAldiMatches = [
    { ingredientId: "ground-beef", productName: "Fresh Ground Beef Chub" },
    { ingredientId: "chicken-breast", productName: "Fresh Family Pack Chicken Breasts" },
    { ingredientId: "chicken-thighs", productName: "Kirkwood Fresh Family Pack Chicken Thighs" },
    { ingredientId: "italian-sausage", productName: "Mild or Hot Italian Sausage" },
    { ingredientId: "ground-turkey", productName: "Kirkwood Fresh 85/15 Ground Turkey" },
    { ingredientId: "mushrooms", productName: "Whole White Mushrooms" },
    { ingredientId: "pork-shoulder", productName: "Fresh Seasoned Pork Shoulder Roast" },
    { ingredientId: "salmon-fillet", productName: "Fresh Atlantic Salmon Side" },
    {
      ingredientId: "shrimp",
      productName: "Fresh Jumbo Raw Peeled & Deveined Tail-Off Shrimp",
    },
    { ingredientId: "hot-sauce", productName: "Burman's Hot Sauce" },
    { ingredientId: "roma-tomatoes", productName: "Snacking Tomatoes On the Vine" },
  ] as const;

  it.each(legitimateAldiMatches)(
    "still matches $productName to $ingredientId",
    ({ ingredientId, productName }) => {
      expect(
        shouldRejectWeeklyAdIngredientMatch({ ingredientId, productName }),
      ).toBe(false);

      const probe = probeWeeklyAdOfferMatch({
        chain: "aldi",
        rawOffer: { productName, price: 2.99 },
        trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
      });

      expect(probe.matchedIngredientId).toBe(ingredientId);
      expect(probe.bestConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    },
  );
});

describe("weekly ad match guards — Food Lion false-positive class", () => {
  it("rejects margarine spread titles as butter", () => {
    expect(
      shouldRejectWeeklyAdIngredientMatch({
        ingredientId: "butter",
        productName: "I Can't Believe It's Not Butter! or Brumel & Brown Spread",
      }),
    ).toBe(true);
  });

  it("does not match margarine spread to butter at weekly-ad threshold", () => {
    const probe = probeWeeklyAdOfferMatch({
      chain: "food-lion",
      rawOffer: {
        productName: "I Can't Believe It's Not Butter! or Brumel & Brown Spread",
        price: 2.99,
      },
      trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
    });

    expect(probe.matchedIngredientId).not.toBe("butter");
    expect(probe.bestConfidence).toBeLessThan(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
  });

  it("still matches Kerrygold butter sticks", () => {
    expect(
      shouldRejectWeeklyAdIngredientMatch({
        ingredientId: "butter",
        productName: "Kerrygold Pure Irish Butter Sticks",
      }),
    ).toBe(false);

    const probe = probeWeeklyAdOfferMatch({
      chain: "food-lion",
      rawOffer: { productName: "Kerrygold Pure Irish Butter Sticks", price: 4.99 },
      trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
    });

    expect(probe.matchedIngredientId).toBe("butter");
    expect(probe.bestConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
  });
});

describe("weekly ad ingredient search terms — Food Lion alias gap", () => {
  it("matches singular flour tortilla titles at weekly-ad threshold", () => {
    const probe = probeWeeklyAdOfferMatch({
      chain: "food-lion",
      rawOffer: { productName: "La Banderita Flour Tortilla", price: 3.49 },
      trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
    });

    expect(probe.matchedIngredientId).toBe("flour-tortillas");
    expect(probe.bestConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
  });
});

describe("weekly ad match guards — Publix false-positive class", () => {
  const falsePositiveCases = [
    { ingredientId: "butter", productName: "Nature's Own Butterbread" },
    { ingredientId: "butter", productName: "Butterhead Lettuce" },
    { ingredientId: "plain-yogurt", productName: "Yasso Frozen Greek Yogurt Bars" },
    { ingredientId: "honey", productName: "Publix Honey Maple Turkey Breast" },
    { ingredientId: "honey", productName: "Marieke Honey Clover Gouda Cheese" },
    { ingredientId: "honey", productName: "Honey Mango" },
    { ingredientId: "vanilla-extract", productName: "Chantilly Berry Vanilla Cupcakes" },
    { ingredientId: "garlic", productName: "Toom Garlic Dip" },
    { ingredientId: "olive-oil", productName: "Rosemary Olive Oil Focaccia" },
    { ingredientId: "bacon", productName: "Boar's Head Firesmith Chicken & Bacon Sandwich" },
    { ingredientId: "shrimp", productName: "Fusha Shrimp and Cheese Ravioli" },
    { ingredientId: "cream-cheese", productName: "Mini S'mores Cream Cheese Pie" },
    { ingredientId: "yellow-onion", productName: "Boar's Head Caramelized Onion Jack Cheese" },
    { ingredientId: "lime", productName: "12-Pack Bud Light Lime Beer" },
  ] as const;

  it.each(falsePositiveCases)(
    "rejects $productName as $ingredientId",
    ({ ingredientId, productName }) => {
      expect(
        shouldRejectWeeklyAdIngredientMatch({ ingredientId, productName }),
      ).toBe(true);
    },
  );

  it.each(falsePositiveCases)(
    "does not match $productName at weekly-ad threshold",
    ({ productName }) => {
      const probe = probeWeeklyAdOfferMatch({
        chain: "publix",
        rawOffer: { productName, price: 2.99 },
        trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
      });

      expect(probe.matchedIngredientId).toBeUndefined();
      expect(probe.bestConfidence).toBeLessThan(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    },
  );

  const legitimatePublixMatches = [
    { ingredientId: "chicken-breast", productName: "Perdue Boneless Skinless Chicken Breasts" },
    { ingredientId: "butter", productName: "Kerrygold Pure Irish Butter Sticks" },
    { ingredientId: "plain-yogurt", productName: "Chobani Greek Yogurt" },
    { ingredientId: "olive-oil", productName: "Bertolli Olive Oil" },
    { ingredientId: "bacon", productName: "Hormel Bacon" },
    { ingredientId: "salmon-fillet", productName: "Salmon Fillets" },
    { ingredientId: "bell-peppers", productName: "Red, Yellow, or Orange Bell Peppers" },
    { ingredientId: "hot-sauce", productName: "Frank's Redhot Sauce" },
    { ingredientId: "shrimp", productName: "Publix Peeled & Deveined White Shrimp" },
    { ingredientId: "garlic", productName: "Spice World Minced Garlic" },
    { ingredientId: "lime", productName: "Persian Limes" },
  ] as const;

  it.each(legitimatePublixMatches)(
    "still matches $productName to $ingredientId",
    ({ ingredientId, productName }) => {
      expect(
        shouldRejectWeeklyAdIngredientMatch({ ingredientId, productName }),
      ).toBe(false);

      const probe = probeWeeklyAdOfferMatch({
        chain: "publix",
        rawOffer: { productName, price: 2.99 },
        trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
      });

      expect(probe.matchedIngredientId).toBe(ingredientId);
      expect(probe.bestConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    },
  );
});

describe("weekly ad match guards — Lidl compound-product false-positive class", () => {
  const falsePositiveCases = [
    { ingredientId: "lemon", productName: "iced lemon muffin" },
    { ingredientId: "spinach", productName: "chicken sausage, spinach & feta, family size" },
  ] as const;

  it.each(falsePositiveCases)(
    "rejects $productName as $ingredientId",
    ({ ingredientId, productName }) => {
      expect(
        shouldRejectWeeklyAdIngredientMatch({ ingredientId, productName }),
      ).toBe(true);
    },
  );

  it.each(falsePositiveCases)(
    "does not match $productName at weekly-ad threshold",
    ({ productName }) => {
      const probe = probeWeeklyAdOfferMatch({
        chain: "lidl",
        rawOffer: { productName, price: 2.99 },
        trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
      });

      expect(probe.matchedIngredientId).toBeUndefined();
      expect(probe.bestConfidence).toBeLessThan(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    },
  );

  const legitimateLidlMatches = [
    { ingredientId: "butter", productName: "sweet cream butter" },
    { ingredientId: "ground-beef", productName: "Butcher's Specialty fresh grass-fed ground beef, 93% lean" },
    { ingredientId: "salmon-fillet", productName: "Fish Market fresh Chilean Atlantic salmon whole fillet, skin on" },
    { ingredientId: "bell-peppers", productName: "red bell peppers" },
  ] as const;

  it.each(legitimateLidlMatches)(
    "still matches $productName to $ingredientId",
    ({ ingredientId, productName }) => {
      expect(
        shouldRejectWeeklyAdIngredientMatch({ ingredientId, productName }),
      ).toBe(false);

      const probe = probeWeeklyAdOfferMatch({
        chain: "lidl",
        rawOffer: { productName, price: 2.99 },
        trackedIngredientIds: WEEKLY_AD_TRACKED_INGREDIENT_IDS,
      });

      expect(probe.matchedIngredientId).toBe(ingredientId);
      expect(probe.bestConfidence).toBeGreaterThanOrEqual(MIN_WEEKLY_AD_MATCH_CONFIDENCE);
    },
  );
});
