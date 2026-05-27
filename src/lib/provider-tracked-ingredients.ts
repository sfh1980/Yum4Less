import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import type { ProviderPricingPreviewIngredient } from "@/lib/providers/provider-types";

export const PROVIDER_TRACKED_INGREDIENTS: ProviderPricingPreviewIngredient[] =
  INTERNAL_CATALOG_INGREDIENTS.slice(0, 5).map((ingredient) => ({
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    searchTerm: ingredient.name,
  }));
