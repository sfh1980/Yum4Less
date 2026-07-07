import type { CatalogIngredient } from "@/lib/ingredient-category";

export function filterIngredientCatalog(
  catalog: CatalogIngredient[],
  query: string,
  limit = 8,
): CatalogIngredient[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return catalog
    .filter((ingredient) => ingredient.name.toLowerCase().includes(normalized))
    .sort((left, right) => {
      const leftStarts = left.name.toLowerCase().startsWith(normalized);
      const rightStarts = right.name.toLowerCase().startsWith(normalized);
      if (leftStarts !== rightStarts) {
        return leftStarts ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}
