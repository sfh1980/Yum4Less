import type { CatalogPriceObservation, CatalogRecipeRecord } from "@/lib/market-catalog-types";
import type { MealPreferenceForm, ShoppingPlanItem } from "@/lib/recommendation-types";
import { getSaleConfidence } from "@/lib/sale-confidence";

export const defaultPreferences: MealPreferenceForm = {
  zipCode: "23111",
  radiusMiles: 6,
  budget: 18,
  maxIngredients: 8,
  shoppingStyle: "single-store",
  dietaryFocus: "anything",
  recipeSource: "internal-library",
  selectedStoreIds: ["kroger-mechanicsville"],
  planningMode: "standard",
};

export function buildRecipe(
  overrides: Partial<CatalogRecipeRecord> = {},
): CatalogRecipeRecord {
  return {
    id: "test-recipe",
    title: "Test Recipe",
    summary: "Fixture recipe for scoring tests.",
    cookTimeMinutes: 25,
    difficulty: "easy",
    tags: [],
    dietaryTags: ["vegetarian"],
    ingredients: [
      { ingredientId: "black-beans", displayName: "Black beans", quantityNote: "1 can" },
      { ingredientId: "lime", displayName: "Lime", quantityNote: "1" },
    ],
    steps: ["Cook."],
    ...overrides,
  };
}

export function buildPlanItem(
  overrides: Partial<ShoppingPlanItem> = {},
): ShoppingPlanItem {
  const base = {
    ingredient: "Black beans",
    quantityNote: "1 can",
    storeName: "Kroger",
    price: 1.09,
    freshnessDaysAgo: 1,
    freshnessHoursAgo: 24,
    priceSource: "kroger-weekly-ad-scrape",
    priceSourceKind: "weekly-ad" as const,
    priceSourceTier: 2,
    matchConfidence: 0.85,
  };

  const merged = { ...base, ...overrides };

  return {
    ...merged,
    saleConfidence:
      overrides.saleConfidence ??
      getSaleConfidence({
        saleLabel: merged.saleLabel,
        freshnessDaysAgo: merged.freshnessDaysAgo,
        freshnessHoursAgo: merged.freshnessHoursAgo,
        dataSource: "database",
        priceSource: merged.priceSource,
        matchConfidence: merged.matchConfidence,
      }),
  };
}

export function buildObservation(
  overrides: Partial<CatalogPriceObservation> = {},
): CatalogPriceObservation {
  return {
    storeId: "kroger-mechanicsville",
    ingredientId: "black-beans",
    price: 1.09,
    priceSource: "kroger-weekly-ad-scrape",
    freshnessDaysAgo: 1,
    inStock: true,
    matchConfidence: 0.85,
    ...overrides,
  };
}

export function buildUniformPlan(
  count: number,
  overrides: Partial<ShoppingPlanItem> = {},
): ShoppingPlanItem[] {
  return Array.from({ length: count }, (_, index) =>
    buildPlanItem({
      ingredient: `Ingredient ${index + 1}`,
      storeName: index === 0 ? "Kroger" : `Store ${index + 1}`,
      ...overrides,
    }),
  );
}
