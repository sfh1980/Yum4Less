/** Postgres `ingredients.category` values (see db/init). */
export type IngredientCategory =
  | "protein"
  | "produce"
  | "pantry"
  | "dairy"
  | "seasoning"
  | "baking"
  | "frozen";

export type CatalogIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
};
