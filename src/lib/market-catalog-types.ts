import type { IngredientCategory } from "@/lib/ingredient-category";

export type StoreKind = "grocery" | "big-box" | "specialty" | "dollar-market";

export type CatalogStore = {
  id: string;
  name: string;
  kind: StoreKind;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  sourceName?: string;
  lastVerifiedAt?: string;
};

export type CatalogIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
};

export type CatalogRecipeIngredient = {
  ingredientId: string;
  displayName: string;
  quantityNote: string;
};

export type CatalogRecipeRecord = {
  id: string;
  title: string;
  summary: string;
  cookTimeMinutes: number;
  difficulty: "easy" | "medium";
  tags: string[];
  dietaryTags: Array<"vegetarian" | "vegan" | "quick">;
  ingredients: CatalogRecipeIngredient[];
  steps: string[];
  sourceName?: string;
  sourceRecipeId?: string;
  eligibleForRanking?: boolean;
};

export type CatalogPriceObservation = {
  storeId: string;
  ingredientId: string;
  price: number;
  saleLabel?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  inStock: boolean;
  priceSource?: string;
  priceSourceKind?: "official-online" | "weekly-ad" | "sample" | "unknown";
  priceSourceTier?: number;
  matchConfidence?: number;
};
