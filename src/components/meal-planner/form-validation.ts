import type { MealPreferenceForm } from "@/lib/recommendation-service";
import {
  DEFAULT_DINNERS_WANTED,
  DEFAULT_MAX_INGREDIENTS,
  DEFAULT_PLANNING_MODE,
} from "@/lib/meal-preference-defaults";
import type { FieldErrors, FormState } from "@/components/meal-planner/types";

function parseNumberField(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateLocationFields(
  form: FormState,
  requireZipCode: boolean,
): Pick<FieldErrors, "zipCode" | "radiusMiles"> {
  const errors: FieldErrors = {};

  const zipCode = form.zipCode.trim();
  if (requireZipCode && !/^\d{5}$/.test(zipCode)) {
    errors.zipCode = "Enter a valid 5-digit ZIP code.";
  }

  const radiusMiles = parseNumberField(form.radiusMiles);
  if (
    radiusMiles === undefined ||
    !Number.isInteger(radiusMiles) ||
    radiusMiles < 1 ||
    radiusMiles > 25
  ) {
    errors.radiusMiles = "Choose a radius between 1 and 25 miles.";
  }

  return errors;
}

export function validateMealFields(
  form: FormState,
): Pick<FieldErrors, "budget"> {
  const errors: FieldErrors = {};

  const budget = parseNumberField(form.budget);
  if (budget === undefined || budget < 5 || budget > 40) {
    errors.budget = "Enter a spending limit between $5 and $40.";
  }

  return errors;
}

export function buildMealPreferencePayload(
  form: FormState,
): MealPreferenceForm | undefined {
  const radiusMiles = parseNumberField(form.radiusMiles);
  const budget = parseNumberField(form.budget);

  if (radiusMiles === undefined || budget === undefined) {
    return undefined;
  }

  return {
    zipCode: form.zipCode.trim(),
    radiusMiles,
    budget,
    maxIngredients: DEFAULT_MAX_INGREDIENTS,
    dinnersWanted: DEFAULT_DINNERS_WANTED,
    shoppingStyle: form.shoppingStyle,
    dietaryFocus: form.dietaryFocus,
    recipeSource: form.recipeSource,
    planningMode: DEFAULT_PLANNING_MODE,
  };
}

export function formatDifficulty(difficulty: string) {
  return `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} cook`;
}

export function formatStoreKind(kind: string) {
  return kind.replace("-", " ");
}
