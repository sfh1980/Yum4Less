import { INTERNAL_CATALOG_INGREDIENTS } from "@/lib/internal-catalog";
import type { ProviderPricingPreviewIngredient } from "@/lib/providers/provider-types";

/**
 * Static fallback when Postgres `provider_search_terms` is empty or unavailable.
 * Uses full internal catalog breadth; search terms are display names (not DB-tuned).
 * Production preview/coverage/sync paths load tuned Kroger terms via
 * {@link resolveKrogerPreviewTrackedIngredients} / {@link resolveKrogerSyncTrackedIngredients}.
 */
export const PROVIDER_TRACKED_INGREDIENTS: ProviderPricingPreviewIngredient[] =
  INTERNAL_CATALOG_INGREDIENTS.map((ingredient) => ({
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    searchTerm: ingredient.name,
  }));
