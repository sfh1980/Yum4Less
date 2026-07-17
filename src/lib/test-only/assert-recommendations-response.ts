/**
 * Shared e2e assertion for POST /api/recommendations responses.
 * Kept pure (no Playwright) so Vitest can proof-of-catch non-200 loud failures.
 */

export const RECOMMENDATIONS_WAIT_TIMEOUT_MS = 60_000;

export type RecommendationsHttpLike = {
  status: number;
  okBody?: { ok?: boolean; error?: string };
};

export type RecommendationsMealListLike = {
  ok?: boolean;
  experience?: { recommendations?: unknown[] };
};

/**
 * Fail loud with an explicit status message — never treat non-200 as a silent wait timeout.
 */
export function assertRecommendationsHttpOk(
  response: RecommendationsHttpLike,
  context = "POST /api/recommendations",
): void {
  const { status, okBody } = response;

  if (status === 200) {
    if (okBody && okBody.ok === false) {
      const detail = okBody.error?.trim() ? `: ${okBody.error.trim()}` : "";
      throw new Error(`${context} returned HTTP 200 but ok:false${detail}`);
    }
    return;
  }

  const apiError = okBody?.error?.trim();
  const detail = apiError ? ` — ${apiError}` : "";

  if (status === 429) {
    throw new Error(
      `${context} rate limited (HTTP 429)${detail}. Rank wait must not hang; fix suite load or raise e2e limit.`,
    );
  }

  if (status >= 500) {
    throw new Error(`${context} server error (HTTP ${status})${detail}`);
  }

  if (status >= 400) {
    throw new Error(`${context} client error (HTTP ${status})${detail}`);
  }

  throw new Error(`${context} unexpected HTTP ${status}${detail}`);
}

/**
 * Fail loud when rank HTTP succeeded but returned zero meals — never hang waiting
 * for a missing accordion with no indication why.
 */
export function assertRecommendationsHaveMeals(
  body: RecommendationsMealListLike,
  context = "POST /api/recommendations",
): void {
  const meals = body.experience?.recommendations;
  const count = Array.isArray(meals) ? meals.length : 0;
  if (count > 0) {
    return;
  }

  throw new Error(
    `${context} returned ok with 0 recipes — meal accordion will never appear. ` +
      "Check fixture ranked coverage / store selection / spending limit; do not wait on .meal-results-accordion-trigger.",
  );
}
