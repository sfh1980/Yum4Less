import { z } from "zod";
import { API_LIMITS } from "@/lib/api-request";
import { FORM_BUDGET_LIMITS } from "@/contracts/shared/limits";

export const shoppingStyleSchema = z.enum(["single-store", "multi-store"]);
export const dietaryFocusSchema = z.enum([
  "anything",
  "vegetarian",
  "vegan",
  "quick",
]);
export const mealPlanningModeSchema = z.enum(["standard", "ingredient-first"]);

/** API accepts up to {@link API_LIMITS.budget.max}; form UI uses {@link FORM_BUDGET_LIMITS}. */
export const apiBudgetSchema = z
  .number()
  .finite()
  .min(API_LIMITS.budget.min)
  .max(API_LIMITS.budget.max);

/** Client form budget ($5–$40) is tighter than API budget ($5–$250) by design. */
export const formBudgetSchema = z
  .number()
  .finite()
  .min(FORM_BUDGET_LIMITS.min)
  .max(FORM_BUDGET_LIMITS.max);

export const maxIngredientsSchema = z
  .number()
  .int()
  .min(API_LIMITS.maxIngredients.min)
  .max(API_LIMITS.maxIngredients.max);

const selectedIngredientIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

const selectedStoreIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

/**
 * Parses optional shopper ingredient narrow.
 * `null` = omit field (server resolves all sale ingredients at selected stores).
 * `undefined` = invalid payload.
 */
export function parseSelectedIngredientIds(
  value: unknown,
): string[] | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.length === 0) {
    return null;
  }

  const ids: string[] = [];

  for (const entry of value) {
    const parsed = selectedIngredientIdSchema.safeParse(entry);
    if (!parsed.success) {
      return undefined;
    }
    ids.push(parsed.data);
  }

  return ids;
}

export function parseSelectedStoreIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  // Store selection for ranking/settings is broader than shopping-route stops,
  // so validate IDs here without reusing the route-planning count cap.
  if (value.length === 0) {
    return undefined;
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const parsed = selectedStoreIdSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data)) {
      if (!parsed.success) {
        return undefined;
      }
      continue;
    }
    seen.add(parsed.data);
    ids.push(parsed.data);
  }

  return ids.length > 0 ? ids : undefined;
}

export function validateSelectedStoreIdsForShoppingStyle(
  selectedStoreIds: string[],
  shoppingStyle: z.infer<typeof shoppingStyleSchema>,
): boolean {
  if (shoppingStyle === "single-store") {
    return selectedStoreIds.length === 1;
  }

  return selectedStoreIds.length >= 1;
}
