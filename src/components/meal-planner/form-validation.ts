import type { MealPreferenceForm } from "@/contracts/recommendations";
import { radiusMilesSchema } from "@/contracts/shared/location";
import { formBudgetSchema } from "@/contracts/shared/meal-preferences";
import { isValidZipCode } from "@/lib/api-request";
import {
  DEFAULT_MAX_INGREDIENTS,
  DEFAULT_PLANNING_MODE,
} from "@/lib/meal-preference-defaults";
import type { FieldErrors, FormState } from "@/components/meal-planner/types";

function parseIntegerField(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

export function validateLocationFields(
  form: FormState,
  requireZipCode: boolean,
): Pick<FieldErrors, "zipCode" | "radiusMiles"> {
  const errors: FieldErrors = {};

  const zipCode = form.zipCode.trim();
  if (requireZipCode && !isValidZipCode(zipCode)) {
    errors.zipCode = "Enter a valid 5-digit ZIP code.";
  }

  const radiusMiles = parseIntegerField(form.radiusMiles);
  if (radiusMiles === undefined || !radiusMilesSchema.safeParse(radiusMiles).success) {
    errors.radiusMiles = "Choose a radius between 1 and 25 miles.";
  }

  return errors;
}

export function validateMealFields(
  form: FormState,
): Pick<FieldErrors, "budget"> {
  const errors: FieldErrors = {};

  const budget = Number(form.budget);
  if (!formBudgetSchema.safeParse(budget).success) {
    errors.budget = "Enter a spending limit between $5 and $40.";
  }

  return errors;
}

export function buildMealPreferencePayload(
  form: FormState,
): MealPreferenceForm | undefined {
  const radiusMiles = parseIntegerField(form.radiusMiles);
  const budget = Number(form.budget);

  if (
    radiusMiles === undefined ||
    !radiusMilesSchema.safeParse(radiusMiles).success ||
    !formBudgetSchema.safeParse(budget).success ||
    form.selectedStoreIds.length === 0
  ) {
    return undefined;
  }

  if (
    form.shoppingStyle === "single-store" &&
    form.selectedStoreIds.length !== 1
  ) {
    return undefined;
  }

  return {
    zipCode: form.zipCode.trim(),
    radiusMiles,
    budget,
    maxIngredients: DEFAULT_MAX_INGREDIENTS,
    shoppingStyle: form.shoppingStyle,
    dietaryFocus: form.dietaryFocus,
    recipeSource: form.recipeSource,
    selectedStoreIds: form.selectedStoreIds,
    planningMode: DEFAULT_PLANNING_MODE,
  };
}

export function defaultSelectedStoreIdsForMarket(
  stores: Array<{ id: string; recommendationEnabled: boolean }>,
  shoppingStyle: MealPreferenceForm["shoppingStyle"],
): string[] {
  const ranked = stores.filter((store) => store.recommendationEnabled);

  if (shoppingStyle === "single-store") {
    return ranked[0] ? [ranked[0].id] : [];
  }

  return ranked.map((store) => store.id);
}

export function formatDifficulty(difficulty: string) {
  return `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} cook`;
}

export function formatStoreKind(kind: string) {
  return kind.replace("-", " ");
}
