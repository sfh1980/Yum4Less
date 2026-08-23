import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import {
  isIngredientCategory,
  type IngredientCategory,
} from "@/lib/ingredient-category";
import { clampListLimit, clampListOffset } from "@/lib/list-limit";
import {
  INGREDIENT_REVIEW_LIMITS,
  resolveIngredientReview,
  listPendingIngredientReviews,
  type IngredientReviewDecision,
} from "@/lib/owner/ingredient-review-repository";
import { publicApiErrorResponse } from "@/lib/public-api-error";

export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerIngredientReviews");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Ingredient review needs a configured database." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const limit = clampListLimit(
    url.searchParams.get("limit"),
    INGREDIENT_REVIEW_LIMITS.default,
    INGREDIENT_REVIEW_LIMITS.max,
  );
  const offset = clampListOffset(url.searchParams.get("offset"));

  try {
    const { reviews, hasMore } = await listPendingIngredientReviews(limit, offset);
    return NextResponse.json({ ok: true, reviews, hasMore, limit, offset });
  } catch (error) {
    return publicApiErrorResponse(
      "api.owner.ingredient-reviews.GET",
      error,
      "Pending ingredient reviews could not be loaded.",
    );
  }
}

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerIngredientReviews");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Ingredient review needs a configured database." },
      { status: 503 },
    );
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const validated = parseIngredientReviewDecision(parsedBody.body);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  try {
    const result = await resolveIngredientReview(validated.decision);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      ingredientId: result.ingredientId,
    });
  } catch (error) {
    return publicApiErrorResponse(
      "api.owner.ingredient-reviews.POST",
      error,
      "That flyer line could not be reviewed.",
    );
  }
}

type ParsedReviewDecision = {
  normalizedLabel: string;
  decision: IngredientReviewDecision;
  ingredientId?: string;
  ingredientName?: string;
  category?: IngredientCategory;
};

function parseIngredientReviewDecision(
  body: unknown,
): { ok: true; decision: ParsedReviewDecision } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Review payload is invalid." };
  }

  const record = body as Record<string, unknown>;
  const normalizedLabel =
    typeof record.normalizedLabel === "string" ? record.normalizedLabel.trim() : "";
  if (normalizedLabel.length < 2 || normalizedLabel.length > 200) {
    return { ok: false, error: "normalizedLabel is required." };
  }

  if (record.decision !== "yes" && record.decision !== "no") {
    return { ok: false, error: "decision must be yes or no." };
  }

  const ingredientId =
    typeof record.ingredientId === "string" && record.ingredientId.trim()
      ? record.ingredientId.trim()
      : undefined;
  const ingredientName =
    typeof record.ingredientName === "string" && record.ingredientName.trim()
      ? record.ingredientName.trim()
      : undefined;
  let category: IngredientCategory | undefined;
  if (typeof record.category === "string" && record.category.trim()) {
    const trimmedCategory = record.category.trim();
    if (!isIngredientCategory(trimmedCategory)) {
      return { ok: false, error: "category is not a valid food category." };
    }
    category = trimmedCategory;
  }

  if (ingredientId && ingredientId.length > 80) {
    return { ok: false, error: "ingredientId is too long." };
  }
  if (ingredientName && ingredientName.length > 80) {
    return { ok: false, error: "ingredientName is too long." };
  }

  return {
    ok: true,
    decision: {
      normalizedLabel,
      decision: record.decision,
      ingredientId,
      ingredientName,
      category,
    },
  };
}
