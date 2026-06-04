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
  } catch {
    return NextResponse.json(
      { ok: false, error: "Recommendations are temporarily unavailable." },
      { status: 500 },
    );
  }
}

function validatePreferences(
  body: Partial<RecommendationRequestPayload>,
): MealPreferenceForm | undefined {
  const shoppingStyle = body.shoppingStyle;
  const dietaryFocus = body.dietaryFocus;
  const validShoppingStyle =
    shoppingStyle === "single-store" || shoppingStyle === "multi-store";
  const validDietaryFocus =
    body.dietaryFocus === "anything" ||
    body.dietaryFocus === "vegetarian" ||
    body.dietaryFocus === "vegan" ||
    body.dietaryFocus === "quick";

  const radiusMiles = clampInteger(body.radiusMiles, API_LIMITS.radiusMiles);
  const budget = clampNumber(body.budget, API_LIMITS.budget);
  const maxIngredients = clampInteger(body.maxIngredients, API_LIMITS.maxIngredients);
  const dinnersWanted = clampInteger(body.dinnersWanted, API_LIMITS.dinnersWanted);
  const hasCoordinates = isValidCoordinatePair(body);
  const zipCode = typeof body.zipCode === "string" ? body.zipCode.trim() : "";

  if (
    radiusMiles === undefined ||
    budget === undefined ||
    maxIngredients === undefined ||
    dinnersWanted === undefined ||
    !validShoppingStyle ||
    !validDietaryFocus ||
    (!hasCoordinates && !isValidZipCode(zipCode))
  ) {
    return undefined;
  }

  const resolvedDietaryFocus = dietaryFocus as MealPreferenceForm["dietaryFocus"];
  const recipeSource = resolveRecipeSource(body.recipeSource);

  if (!recipeSource) {
    return undefined;
  }

  return {
    zipCode: hasCoordinates && !isValidZipCode(zipCode) ? "" : zipCode,
    radiusMiles,
    budget,
    maxIngredients,
    dinnersWanted,
    shoppingStyle,
    dietaryFocus: resolvedDietaryFocus,
    recipeSource,
  };
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
};
