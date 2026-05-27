import type { MealPreferenceForm } from "@/lib/recommendation-service";
import type { FieldErrors, FormState } from "@/components/recommendation-demo/types";

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
): Pick<FieldErrors, "budget" | "maxIngredients" | "dinnersWanted"> {
  const errors: FieldErrors = {};

  const budget = parseNumberField(form.budget);
  if (budget === undefined || budget < 5 || budget > 40) {
    errors.budget = "Enter a budget between $5 and $40.";
  }

  const maxIngredients = parseNumberField(form.maxIngredients);
  if (
    maxIngredients === undefined ||
    !Number.isInteger(maxIngredients) ||
    maxIngredients < 3 ||
    maxIngredients > 12
  ) {
    errors.maxIngredients = "Choose between 3 and 12 ingredients.";
  }

  const dinnersWanted = parseNumberField(form.dinnersWanted);
  if (
    dinnersWanted === undefined ||
    !Number.isInteger(dinnersWanted) ||
    dinnersWanted < 1 ||
    dinnersWanted > 4
  ) {
    errors.dinnersWanted = "Choose between 1 and 4 dinner options.";
  }

  return errors;
}

export function buildMealPreferencePayload(
  form: FormState,
): MealPreferenceForm | undefined {
  const radiusMiles = parseNumberField(form.radiusMiles);
  const budget = parseNumberField(form.budget);
  const maxIngredients = parseNumberField(form.maxIngredients);
  const dinnersWanted = parseNumberField(form.dinnersWanted);

  if (
    radiusMiles === undefined ||
    budget === undefined ||
    maxIngredients === undefined ||
    dinnersWanted === undefined
  ) {
    return undefined;
  }

  return {
    zipCode: form.zipCode.trim(),
    radiusMiles,
    budget,
    maxIngredients,
    dinnersWanted,
    shoppingStyle: form.shoppingStyle,
    dietaryFocus: form.dietaryFocus,
    recipeSource: form.recipeSource,
  };
}

export function formatDifficulty(difficulty: string) {
  return `${difficulty[0]!.toUpperCase()}${difficulty.slice(1)} cook`;
}

export function formatStoreKind(kind: string) {
  return kind.replace("-", " ");
}
