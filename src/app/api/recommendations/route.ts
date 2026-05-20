import { NextResponse } from "next/server";
import { resolveZipLocation } from "@/lib/geocoding";
import {
  getRecommendationExperience,
  type MealPreferenceForm,
} from "@/lib/mock-recommendations";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<MealPreferenceForm>;
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

  const zipLookup = await resolveZipLocation(preferences.zipCode);
  if (!zipLookup.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: zipLookup.error,
        providerConfigured: zipLookup.providerConfigured,
      },
      { status: 404 },
    );
  }

  const experience = await getRecommendationExperience(
    preferences,
    zipLookup.location,
    zipLookup.providerConfigured,
  );

  return NextResponse.json({
    ok: true,
    experience,
  });
}

function validatePreferences(
  body: Partial<MealPreferenceForm>,
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

  if (
    typeof body.zipCode !== "string" ||
    typeof body.radiusMiles !== "number" ||
    typeof body.budget !== "number" ||
    typeof body.maxIngredients !== "number" ||
    typeof body.dinnersWanted !== "number" ||
    !validShoppingStyle ||
    !validDietaryFocus
  ) {
    return undefined;
  }

  const resolvedDietaryFocus = dietaryFocus as MealPreferenceForm["dietaryFocus"];

  return {
    zipCode: body.zipCode,
    radiusMiles: body.radiusMiles,
    budget: body.budget,
    maxIngredients: body.maxIngredients,
    dinnersWanted: body.dinnersWanted,
    shoppingStyle,
    dietaryFocus: resolvedDietaryFocus,
  };
}
