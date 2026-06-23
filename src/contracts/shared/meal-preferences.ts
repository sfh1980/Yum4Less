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

export const apiBudgetSchema = z
  .number()
  .finite()
  .min(API_LIMITS.budget.min)
  .max(API_LIMITS.budget.max);

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

export const dinnersWantedSchema = z
  .number()
  .int()
  .min(API_LIMITS.dinnersWanted.min)
  .max(API_LIMITS.dinnersWanted.max);

const selectedIngredientIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

export function parseSelectedIngredientIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  if (value.length > 40) {
    return undefined;
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
