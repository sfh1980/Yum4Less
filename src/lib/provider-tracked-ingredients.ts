import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import type { ProviderPricingPreviewIngredient } from "@/lib/providers/provider-types";

// TODO(provider-search-terms): Preview/coverage paths keep static catalog display names as
// search terms. The sync script loads tuned Kroger terms from provider_search_terms instead.
export const PROVIDER_TRACKED_INGREDIENTS: ProviderPricingPreviewIngredient[] =
  INTERNAL_CATALOG_INGREDIENTS.slice(0, 5).map((ingredient) => ({
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    searchTerm: ingredient.name,
  }));
