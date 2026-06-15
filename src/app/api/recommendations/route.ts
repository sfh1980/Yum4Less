import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import {
  API_LIMITS,
  clampInteger,
  clampNumber,
  isValidCoordinatePair,
  isValidZipCode,
  parseJsonBody,
} from "@/lib/api-request";
import { publicApiErrorResponse } from "@/lib/public-api-error";
import { sanitizeMarketSummaryForPublicApi } from "@/lib/public-api-response-sanitizer";
import { resolveLocationInput } from "@/lib/location-resolution";
import {
  getRecommendationExperience,
  type MealPreferenceForm,
} from "@/lib/recommendation-service";
import {
  getDefaultRecipeSource,
  listSelectableRecipeSources,
} from "@/lib/recipe-sources/recipe-source-registry";
import {
  DEFAULT_DINNERS_WANTED,
  DEFAULT_MAX_INGREDIENTS,
  DEFAULT_PLANNING_MODE,
} from "@/lib/meal-preference-defaults";
import type { RecipeSourceSelection } from "@/lib/recipe-sources/recipe-source-types";

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiRecommendations");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const body = parsedBody.body as Partial<RecommendationRequestPayload>;
  const preferences = validatePreferences(body);

  if (!preferences) {
    return NextResponse.json(
      {
        ok: false,
        error: "Recommendation request payload is invalid.",
      },
      { status: 400 },
    );
  }

  try {
    const locationResult = await resolveLocationInput(body);
    if (!locationResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: locationResult.error,
          providerConfigured: locationResult.providerConfigured,
        },
        { status: 404 },
      );
    }

    const experience = await getRecommendationExperience(
      preferences,
      locationResult.location,
      locationResult.providerConfigured,
    );

    return NextResponse.json(
      {
        ok: true,
        experience: {
          ...experience,
          market: sanitizeMarketSummaryForPublicApi(experience.market),
        },
      });
  } catch (error) {
    return publicApiErrorResponse(
      "api.recommendations",
      error,
      "Recommendations are temporarily unavailable.",
    );
  }
}

function validatePreferences(
  body: Partial<RecommendationRequestPayload>,
): MealPreferenceForm | undefined {
  const shoppingStyle = body.shoppingStyle;
  const dietaryFocus = body.dietaryFocus;
  const planningMode = body.planningMode;
  const validShoppingStyle =
    shoppingStyle === "single-store" || shoppingStyle === "multi-store";
  const validDietaryFocus =
    body.dietaryFocus === "anything" ||
    body.dietaryFocus === "vegetarian" ||
    body.dietaryFocus === "vegan" ||
    body.dietaryFocus === "quick";
  const validPlanningMode =
    planningMode === undefined ||
    planningMode === "standard" ||
    planningMode === "ingredient-first";

  const radiusMiles = clampInteger(body.radiusMiles, API_LIMITS.radiusMiles);
  const budget = clampNumber(body.budget, API_LIMITS.budget);
  const maxIngredients =
    body.maxIngredients === undefined || body.maxIngredients === null
      ? DEFAULT_MAX_INGREDIENTS
      : clampInteger(body.maxIngredients, API_LIMITS.maxIngredients);
  const dinnersWanted =
    body.dinnersWanted === undefined || body.dinnersWanted === null
      ? DEFAULT_DINNERS_WANTED
      : clampInteger(body.dinnersWanted, API_LIMITS.dinnersWanted);
  const hasCoordinates = isValidCoordinatePair(body);
  const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : "";

  if (
    radiusMiles === undefined ||
    budget === undefined ||
    maxIngredients === undefined ||
    dinnersWanted === undefined ||
    !validShoppingStyle ||
    !validDietaryFocus ||
    !validPlanningMode ||
    (!hasCoordinates && !isValidZipCode(zipCode))
  ) {
    return undefined;
  }

  const resolvedDietaryFocus = dietaryFocus as MealPreferenceForm["dietaryFocus"];
  const recipeSource = resolveRecipeSource(body.recipeSource);
  const selectedIngredientIds = parseSelectedIngredientIds(body.selectedIngredientIds);
  const recipeSourceOptIn = body.recipeSourceOptIn === true;

  if (!recipeSource || selectedIngredientIds === undefined) {
    return undefined;
  }

  if (recipeSource !== "internal-library" && !recipeSourceOptIn) {
    return undefined;
  }

  const resolvedPlanningMode =
    planningMode === "standard" ? "standard" : DEFAULT_PLANNING_MODE;

  return {
    zipCode: hasCoordinates && !isValidZipCode(zipCode) ? "" : zipCode,
    radiusMiles,
    budget,
    maxIngredients,
    dinnersWanted,
    shoppingStyle,
    dietaryFocus: resolvedDietaryFocus,
    recipeSource,
    ...(recipeSourceOptIn ? { recipeSourceOptIn: true } : {}),
    planningMode: resolvedPlanningMode,
    ...(selectedIngredientIds.length > 0
      ? { selectedIngredientIds }
      : resolvedPlanningMode === "ingredient-first"
        ? { selectedIngredientIds: [] }
        : {}),
  };
}

function parseSelectedIngredientIds(value: unknown): string[] | undefined {
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
    if (typeof entry !== "string") {
      return undefined;
    }

    const trimmed = entry.trim();
    if (!trimmed || trimmed.length > 80 || !/^[a-z0-9-]+$/.test(trimmed)) {
      return undefined;
    }

    ids.push(trimmed);
  }

  return ids;
}

function resolveRecipeSource(
  value: unknown,
): RecipeSourceSelection | undefined {
  if (value === undefined || value === null || value === "") {
    return getDefaultRecipeSource();
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const allowed = listSelectableRecipeSources().map((source) => source.id);
  if (!allowed.includes(value as RecipeSourceSelection)) {
    return undefined;
  }

  return value as RecipeSourceSelection;
}

type RecommendationRequestPayload = MealPreferenceForm & {
  latitude?: number;
  longitude?: number;
  selectedIngredientIds?: string[];
  recipeSourceOptIn?: boolean;
};
