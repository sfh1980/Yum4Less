import type { RankedPriceSourceKind } from "@/lib/price-source-policy";

export type StoreKind = "grocery" | "big-box" | "specialty" | "dollar-market";

export type StoreRecord = {
  id: string;
  name: string;
  kind: StoreKind;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type IngredientRecord = {
  id: string;
  name: string;
  category: "protein" | "produce" | "pantry" | "dairy";
};

export type RecipeIngredientRecord = {
  ingredientId: string;
  displayName: string;
  quantityNote: string;
};

export type RecipeRecord = {
  id: string;
  title: string;
  summary: string;
  cookTimeMinutes: number;
  difficulty: "easy" | "medium";
  tags: string[];
  dietaryTags: Array<"vegetarian" | "vegan" | "quick">;
  ingredients: RecipeIngredientRecord[];
  steps: string[];
};

export type PriceObservationRecord = {
  storeId: string;
  ingredientId: string;
  price: number;
  saleLabel?: string;
  freshnessDaysAgo: number;
  freshnessHoursAgo?: number;
  inStock: boolean;
  priceSource?: string;
  priceSourceKind?: RankedPriceSourceKind;
  priceSourceTier?: number;
  matchConfidence?: number;
};
