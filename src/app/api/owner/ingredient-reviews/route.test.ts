import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/owner/ingredient-reviews/route";
import { POST as postRecommendations } from "@/app/api/recommendations/route";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

const originalFeedbackAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
const originalDatabaseUrl = process.env.DATABASE_URL;

const listPendingIngredientReviews = vi.fn();
const resolveIngredientReview = vi.fn();

vi.mock("@/lib/owner/ingredient-review-repository", () => ({
  INGREDIENT_REVIEW_LIMITS: { default: 50, max: 100 },
  listPendingIngredientReviews: (...args: unknown[]) =>
    listPendingIngredientReviews(...args),
  resolveIngredientReview: (...args: unknown[]) => resolveIngredientReview(...args),
}));

vi.mock("@/lib/location-resolution", () => ({
  resolveLocationInput: vi.fn(async () => ({
    ok: false,
    error: "Location is not needed for this test.",
    providerConfigured: false,
  })),
  buildSearchLocationLabel: vi.fn(),
}));

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("/api/owner/ingredient-reviews", () => {
  afterEach(() => {
    resetRateLimitsForTests();
    listPendingIngredientReviews.mockReset();
    resolveIngredientReview.mockReset();
    restoreEnv("YUM4LESS_FEEDBACK_ADMIN_KEY", originalFeedbackAdminKey);
    restoreEnv("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns 401 for GET without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await GET(new Request("http://localhost/api/owner/ingredient-reviews"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
    expect(listPendingIngredientReviews).not.toHaveBeenCalled();
  });

  it("returns 401 for POST without an admin key", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await POST(
      new Request("http://localhost/api/owner/ingredient-reviews", {
        method: "POST",
        body: JSON.stringify({
          normalizedLabel: "bartlett pears",
          decision: "yes",
        }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
    expect(resolveIngredientReview).not.toHaveBeenCalled();
  });

  it("lists pending reviews when the admin key is valid", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    listPendingIngredientReviews.mockResolvedValue({
      reviews: [
        {
          id: 3,
          normalizedLabel: "bartlett pears",
          rawProductName: "Bartlett Pears",
          chain: "kroger",
          seenAt: "2026-08-22T00:00:00.000Z",
          suggestedIngredientId: "pears",
          suggestedName: "Pears",
          suggestedCategory: "produce",
        },
      ],
      hasMore: false,
    });

    const response = await GET(
      new Request("http://localhost/api/owner/ingredient-reviews", {
        headers: { Authorization: "Bearer test-admin-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      reviews: [expect.objectContaining({ normalizedLabel: "bartlett pears" })],
      hasMore: false,
    });
    expect(listPendingIngredientReviews).toHaveBeenCalledWith(50, 0);
  });

  it("writes a yes/no decision when the admin key is valid", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    resolveIngredientReview.mockResolvedValue({ ok: true, ingredientId: "pears" });

    const response = await POST(
      new Request("http://localhost/api/owner/ingredient-reviews", {
        method: "POST",
        headers: { Authorization: "Bearer test-admin-key" },
        body: JSON.stringify({
          normalizedLabel: "bartlett pears",
          decision: "yes",
          ingredientId: "pears",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ingredientId: "pears",
    });
    expect(resolveIngredientReview).toHaveBeenCalledWith({
      normalizedLabel: "bartlett pears",
      decision: "yes",
      ingredientId: "pears",
      ingredientName: undefined,
      category: undefined,
    });
  });

  it("slugifies a new food id and passes name and category through", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";
    resolveIngredientReview.mockResolvedValue({
      ok: true,
      ingredientId: "imitation-crab",
    });

    const response = await POST(
      new Request("http://localhost/api/owner/ingredient-reviews", {
        method: "POST",
        headers: { Authorization: "Bearer test-admin-key" },
        body: JSON.stringify({
          normalizedLabel: "imitation crab meat",
          decision: "yes",
          ingredientId: "Imitation Crab",
          ingredientName: "Imitation crab",
          category: "protein",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      ingredientId: "imitation-crab",
    });
    expect(resolveIngredientReview).toHaveBeenCalledWith({
      normalizedLabel: "imitation crab meat",
      decision: "yes",
      ingredientId: "imitation-crab",
      ingredientName: "Imitation crab",
      category: "protein",
    });
  });

  it("rejects a food id that cannot be slugified", async () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "test-admin-key";
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await POST(
      new Request("http://localhost/api/owner/ingredient-reviews", {
        method: "POST",
        headers: { Authorization: "Bearer test-admin-key" },
        body: JSON.stringify({
          normalizedLabel: "imitation crab meat",
          decision: "yes",
          ingredientId: "!!!",
          ingredientName: "Imitation crab",
          category: "protein",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/kebab-case/i),
    });
    expect(resolveIngredientReview).not.toHaveBeenCalled();
  });

  it("does not let public /api/recommendations write ingredient reviews", async () => {
    process.env.DATABASE_URL = "postgres://yum4less/test";

    const response = await postRecommendations(
      new Request("http://localhost/api/recommendations", {
        method: "POST",
        body: JSON.stringify({
          normalizedLabel: "bartlett pears",
          decision: "yes",
          zipCode: "23111",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(resolveIngredientReview).not.toHaveBeenCalled();
    expect(listPendingIngredientReviews).not.toHaveBeenCalled();
  });
});
