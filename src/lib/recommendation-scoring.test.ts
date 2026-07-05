import { describe, expect, it } from "vitest";
import {
  compareObservationQuality,
  comparePlanQuality,
  getConfidenceLabel,
  getFreshnessLabel,
  getPlanQuality,
  scoreCandidate,
} from "@/lib/recommendation-scoring";
import {
  buildObservation,
  buildPlanItem,
  buildRecipe,
  buildUniformPlan,
  defaultPreferences,
} from "@/lib/recommendation-scoring.fixture";

describe("scoreCandidate", () => {
  it("rewards meals well under budget on the price component", () => {
    const score = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 10.68,
    });

    expect(score.price).toBe(34);
  });

  it("clamps price score at zero when estimated total far exceeds budget", () => {
    const score = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 40,
    });

    expect(score.price).toBe(0);
  });

  it("clamps price score at forty for very low totals", () => {
    const score = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 0.5,
    });

    expect(score.price).toBe(40);
  });

  it("penalizes multi-store plans on convenience", () => {
    const singleStore = scoreCandidate({
      recipe: buildRecipe({ cookTimeMinutes: 25 }),
      shoppingPlan: [buildPlanItem({ storeName: "Kroger" })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });
    const multiStore = scoreCandidate({
      recipe: buildRecipe({ cookTimeMinutes: 25 }),
      shoppingPlan: [
        buildPlanItem({ storeName: "Kroger" }),
        buildPlanItem({ storeName: "Aldi", ingredient: "Lime" }),
      ],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(singleStore.convenience).toBe(30);
    expect(multiStore.convenience).toBe(20);
  });

  it("penalizes long cook times on convenience", () => {
    const quick = scoreCandidate({
      recipe: buildRecipe({ cookTimeMinutes: 25 }),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });
    const slow = scoreCandidate({
      recipe: buildRecipe({ cookTimeMinutes: 45 }),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(quick.convenience).toBe(30);
    expect(slow.convenience).toBe(10);
  });

  it("clamps convenience at zero for very long multi-store meals", () => {
    const score = scoreCandidate({
      recipe: buildRecipe({ cookTimeMinutes: 90 }),
      shoppingPlan: buildUniformPlan(4),
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(score.convenience).toBe(0);
  });

  it("prefers fresher observations on the freshness component", () => {
    const fresh = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem({ freshnessHoursAgo: 6, freshnessDaysAgo: 0 })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });
    const stale = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem({ freshnessHoursAgo: 96, freshnessDaysAgo: 4 })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(fresh.freshness).toBeGreaterThan(stale.freshness);
  });

  it("applies weak-match penalty when confidence is below 0.7", () => {
    const strong = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem({ matchConfidence: 0.85 })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });
    const weak = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem({ matchConfidence: 0.55 })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(strong.freshness - weak.freshness).toBe(3);
  });

  it("clamps freshness between four and twenty", () => {
    const veryStale = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [
        buildPlanItem({
          freshnessHoursAgo: 500,
          freshnessDaysAgo: 21,
          priceSourceTier: 4,
          matchConfidence: 0.5,
        }),
      ],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(veryStale.freshness).toBe(4);
  });

  it("boosts fit when dietary focus matches recipe tags", () => {
    const preferences = { ...defaultPreferences, maxIngredients: 5 };
    const matched = scoreCandidate({
      recipe: buildRecipe({ dietaryTags: ["vegetarian"] }),
      shoppingPlan: [buildPlanItem()],
      preferences: { ...preferences, dietaryFocus: "vegetarian" },
      estimatedTotal: 10,
    });
    const neutral = scoreCandidate({
      recipe: buildRecipe({ dietaryTags: ["vegetarian"] }),
      shoppingPlan: [buildPlanItem()],
      preferences,
      estimatedTotal: 10,
    });

    expect(matched.fit).toBe(neutral.fit + 4);
  });

  it("rewards fewer recipe ingredients on fit", () => {
    const compact = scoreCandidate({
      recipe: buildRecipe({ ingredients: buildRecipe().ingredients.slice(0, 2) }),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });
    const large = scoreCandidate({
      recipe: buildRecipe({
        ingredients: [
          ...buildRecipe().ingredients,
          { ingredientId: "cumin", displayName: "Cumin", quantityNote: "1 tsp" },
          { ingredientId: "garlic", displayName: "Garlic", quantityNote: "3 cloves" },
        ],
      }),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(compact.fit).toBeGreaterThan(large.fit);
  });

  it("sums component scores into total", () => {
    const score = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem()],
      preferences: defaultPreferences,
      estimatedTotal: 10.68,
    });

    expect(score.total).toBe(score.price + score.convenience + score.freshness + score.fit);
  });

  it("uses freshnessHoursAgo when present instead of days", () => {
    const hours = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem({ freshnessHoursAgo: 6, freshnessDaysAgo: 99 })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });
    const days = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [buildPlanItem({ freshnessHoursAgo: undefined, freshnessDaysAgo: 2 })],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(hours.freshness).toBeGreaterThan(days.freshness);
  });

  it("derives tier from priceSource when tier is omitted", () => {
    const score = scoreCandidate({
      recipe: buildRecipe(),
      shoppingPlan: [
        buildPlanItem({
          priceSource: "kroger-official-api",
          priceSourceTier: undefined,
        }),
      ],
      preferences: defaultPreferences,
      estimatedTotal: 10,
    });

    expect(score.freshness).toBeLessThan(20);
  });
});

describe("comparePlanQuality", () => {
  it("prefers lower average tier", () => {
    const betterTier = [buildPlanItem({ priceSourceTier: 1 })];
    const worseTier = [buildPlanItem({ priceSourceTier: 3 })];

    expect(comparePlanQuality(betterTier, worseTier)).toBeLessThan(0);
  });

  it("breaks tier ties with fresher average hours", () => {
    const fresher = [buildPlanItem({ freshnessHoursAgo: 6 })];
    const staler = [buildPlanItem({ freshnessHoursAgo: 48 })];

    expect(comparePlanQuality(fresher, staler)).toBeLessThan(0);
  });

  it("breaks freshness ties with higher average confidence", () => {
    const confident = [buildPlanItem({ matchConfidence: 0.95 })];
    const weaker = [buildPlanItem({ matchConfidence: 0.72 })];

    expect(comparePlanQuality(confident, weaker)).toBeLessThan(0);
  });

  it("breaks confidence ties with lower total price", () => {
    const cheaper = [buildPlanItem({ price: 1.09 })];
    const pricier = [buildPlanItem({ price: 2.49 })];

    expect(comparePlanQuality(cheaper, pricier)).toBeLessThan(0);
  });

  it("returns zero for identical plans", () => {
    const plan = [buildPlanItem()];

    expect(comparePlanQuality(plan, plan)).toBe(0);
  });
});

describe("compareObservationQuality", () => {
  it("prefers lower source tier", () => {
    const left = buildObservation({ priceSourceTier: 1, priceSource: "kroger-official-api" });
    const right = buildObservation({ priceSourceTier: 3, priceSource: "kroger-weekly-ad-scrape" });

    expect(compareObservationQuality(left, right)).toBeLessThan(0);
  });

  it("breaks tier ties with fresher observations", () => {
    const left = buildObservation({ freshnessHoursAgo: 4 });
    const right = buildObservation({ freshnessHoursAgo: 30 });

    expect(compareObservationQuality(left, right)).toBeLessThan(0);
  });

  it("breaks freshness ties with higher match confidence", () => {
    const left = buildObservation({ matchConfidence: 0.92 });
    const right = buildObservation({ matchConfidence: 0.71 });

    expect(compareObservationQuality(left, right)).toBeLessThan(0);
  });

  it("breaks confidence ties with lower price", () => {
    const left = buildObservation({ price: 0.89 });
    const right = buildObservation({ price: 1.29 });

    expect(compareObservationQuality(left, right)).toBeLessThan(0);
  });

  it("returns zero for identical observations", () => {
    const observation = buildObservation();

    expect(compareObservationQuality(observation, observation)).toBe(0);
  });
});

describe("getPlanQuality", () => {
  it("aggregates tier, freshness, confidence, and total", () => {
    const quality = getPlanQuality([
      buildPlanItem({ price: 2, priceSourceTier: 2, freshnessHoursAgo: 12, matchConfidence: 0.8 }),
      buildPlanItem({ price: 3, priceSourceTier: 4, freshnessHoursAgo: 24, matchConfidence: 0.9 }),
    ]);

    expect(quality.averageTier).toBe(3);
    expect(quality.averageFreshnessHours).toBe(18);
    expect(quality.averageConfidence).toBeCloseTo(0.85);
    expect(quality.total).toBe(5);
  });
});

describe("freshness and confidence labels", () => {
  it("labels online prices checked within one hour", () => {
    const label = getFreshnessLabel([
      buildPlanItem({
        priceSourceKind: "official-online",
        freshnessHoursAgo: 0.5,
        freshnessDaysAgo: 0,
      }),
    ]);

    expect(label).toBe("Checked within 1 hour");
  });

  it("labels same-day online prices within twenty-four hours", () => {
    const label = getFreshnessLabel([
      buildPlanItem({
        priceSourceKind: "official-online",
        freshnessHoursAgo: 12,
        freshnessDaysAgo: 0,
      }),
    ]);

    expect(label).toBe("Same-day online prices");
  });

  it("labels recent sale prices within three and a half days", () => {
    const label = getFreshnessLabel([
      buildPlanItem({
        priceSourceKind: "weekly-ad",
        freshnessHoursAgo: 48,
        freshnessDaysAgo: 2,
      }),
    ]);

    expect(label).toBe("Recent sale prices");
  });

  it("warns when sale prices are older than three and a half days", () => {
    const label = getFreshnessLabel([
      buildPlanItem({
        priceSourceKind: "weekly-ad",
        freshnessHoursAgo: 120,
        freshnessDaysAgo: 5,
      }),
    ]);

    expect(label).toBe("Older prices — verify in store");
  });

  it("labels single-store plans", () => {
    expect(getConfidenceLabel([buildPlanItem({ storeName: "Kroger" })])).toBe(
      "Single-store estimate",
    );
  });

  it("labels multi-store plans", () => {
    expect(
      getConfidenceLabel([
        buildPlanItem({ storeName: "Kroger" }),
        buildPlanItem({ storeName: "Aldi", ingredient: "Lime" }),
      ]),
    ).toBe("Multi-store estimate");
  });
});
