import { shouldRejectThemealdbIngredientLabel } from "@/lib/recipe-import/themealdb-reject-patterns";

/** Postgres `ingredients.category` values (see db/init). */
export const INGREDIENT_CATEGORIES = [
  "protein",
  "produce",
  "pantry",
  "dairy",
  "seasoning",
  "baking",
  "frozen",
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export function isIngredientCategory(value: string): value is IngredientCategory {
  return (INGREDIENT_CATEGORIES as readonly string[]).includes(value);
}

export type CatalogIngredient = {
  id: string;
  name: string;
  category: IngredientCategory;
};

/** Client-safe category inference for shopper-facing ingredient chips. */
export function inferIngredientCategory(label: string): IngredientCategory | null {
  const lower = label.toLowerCase();

  if (/\b(chicken|beef|pork|lamb|turkey|sausage|bacon|salmon|shrimp|prawn|tofu|fish)\b/i.test(lower)) {
    return "protein";
  }
  if (/\b(milk|cheese|cream|butter|yogurt|egg)\b/i.test(lower)) {
    return "dairy";
  }
  if (/\b(onion|garlic|pepper|tomato|potato|carrot|broccoli|spinach|lemon|lime|mushroom|avocado|celery|zucchini|cabbage|lettuce|herb|basil|parsley|cilantro|coriander)\b/i.test(lower)) {
    return "produce";
  }
  if (/\b(rice|pasta|noodle|flour|sugar|honey|oil|vinegar|sauce|broth|stock|bean|lentil|chickpea|corn|tortilla|bread|can)\b/i.test(lower)) {
    return "pantry";
  }
  if (/\b(salt|pepper|cumin|paprika|oregano|basil|thyme|rosemary|spice|seasoning|mustard|soy)\b/i.test(lower)) {
    return "seasoning";
  }
  if (/\b(frozen)\b/i.test(lower)) {
    return "frozen";
  }
  if (/\b(sugar|baking|vanilla|yeast)\b/i.test(lower)) {
    return "baking";
  }

  if (lower.length >= 3 && !shouldRejectThemealdbIngredientLabel(label)) {
    return "pantry";
  }

  return null;
}
