import type { CatalogIngredient, IngredientCategory } from "@/lib/ingredient-category";
import {
  slugifyIngredientId,
} from "@/lib/recipe-import/ingredient-normalization";
import { stripWeeklyAdPackagingTokens } from "@/lib/weekly-ad-ingestion/weekly-ad-label-normalize";

const PRODUCE_HEADS: Record<string, string> = {
  pear: "pears",
  pears: "pears",
  orange: "oranges",
  oranges: "oranges",
  apple: "apples",
  apples: "apples",
  banana: "bananas",
  bananas: "bananas",
  grape: "grapes",
  grapes: "grapes",
};

const PROTEIN_HEADS: Record<string, string> = {
  pollock: "pollock",
  loin: "pork-loin",
};

export function inferStrictWeeklyAdFoodCategory(
  label: string,
): IngredientCategory | null {
  const lower = label.toLowerCase();
  if (
    /\b(chicken|beef|pork|lamb|turkey|sausage|bacon|salmon|shrimp|prawn|tofu|fish|pollock)\b/i.test(
      lower,
    )
  ) {
    return "protein";
  }
  if (/\b(milk|cheese|cream|butter|yogurt|egg)\b/i.test(lower)) {
    return "dairy";
  }
  if (
    /\b(onion|garlic|pepper|tomato|potato|carrot|broccoli|spinach|lemon|lime|mushroom|avocado|celery|zucchini|cabbage|lettuce|herb|basil|parsley|cilantro|coriander|pears?|oranges?|apples?|bananas?|grapes?)\b/i.test(
      lower,
    )
  ) {
    return "produce";
  }
  return null;
}

export function resolveCanonicalSimpleFood(
  normalizedLabel: string,
): CatalogIngredient | null {
  const stripped = stripWeeklyAdPackagingTokens(normalizedLabel);
  if (!stripped) {
    return null;
  }

  const tokens = stripped.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) {
    return null;
  }

  const last = tokens[tokens.length - 1] ?? "";
  const lastTwo = tokens.slice(-2).join(" ");
  let id = "";
  let name = "";

  if (lastTwo === "pork loin" || (tokens.includes("pork") && last === "loin")) {
    id = "pork-loin";
    name = "Pork loin";
  } else if (PROTEIN_HEADS[last]) {
    id = PROTEIN_HEADS[last]!;
    name = titleCase(id.replace(/-/g, " "));
  } else if (PRODUCE_HEADS[last]) {
    id = PRODUCE_HEADS[last]!;
    name = titleCase(id);
  } else {
    id = slugifyIngredientId(stripped);
    name = titleCase(stripped);
  }

  if (!id) {
    return null;
  }

  const category = inferStrictWeeklyAdFoodCategory(stripped);
  if (!category) {
    return null;
  }

  return { id, name, category };
}

function titleCase(value: string): string {
  return value
    .split(/\s+/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
