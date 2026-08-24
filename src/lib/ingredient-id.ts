/** Max length of `ingredients.id` after slugify (catalog + owner create). */
export const CANONICAL_INGREDIENT_ID_MAX = 56;

const CANONICAL_INGREDIENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lowercase kebab-case food id, letters/numbers/hyphens only. */
export function slugifyIngredientId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CANONICAL_INGREDIENT_ID_MAX);
}

export function isCanonicalIngredientId(value: string): boolean {
  return (
    value.length >= 2 &&
    value.length <= CANONICAL_INGREDIENT_ID_MAX &&
    CANONICAL_INGREDIENT_ID_PATTERN.test(value)
  );
}

/** Short shopper-facing name from a flyer label or typed title. */
export function titleCaseIngredientName(value: string): string {
  return value
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
