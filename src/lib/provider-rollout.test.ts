import { describe, expect, it } from "vitest";
import {
  getProviderRolloutForStore,
  listProviderRollout,
  resolveProviderRolloutForStore,
  listResolvedProviderRollout,
} from "@/lib/provider-rollout";

describe("provider rollout", () => {
  it("marks prioritized Kroger stores as coming soon until weekly-ad promotion passes", () => {
    const rollout = getProviderRolloutForStore("Kroger Mechanicsville");

    expect(rollout.chain).toBe("kroger");
    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
  });

  it("labels Aldi as beta weekly-ad estimates before promotion passes", () => {
    const rollout = getProviderRolloutForStore("Aldi");

    expect(rollout.chain).toBe("aldi");
    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
    expect(rollout.note).toContain("BETA");
    expect(rollout.note).toContain("weekly-ad");
  });

  it("maps Kroger-family banner names to the Kroger rollout", () => {
    expect(getProviderRolloutForStore("Harris Teeter").chain).toBe("kroger");
    expect(getProviderRolloutForStore("Ralphs").chain).toBe("kroger");
  });

  it("labels Food Lion as beta weekly-ad estimates before promotion passes", () => {
    const rollout = getProviderRolloutForStore("Food Lion");

    expect(rollout.chain).toBe("food-lion");
    expect(rollout.note).toContain("BETA");
    expect(rollout.note).toContain("weekly-ad");
  });

  it("lists the approved rollout order for the MVP roadmap", () => {
    expect(listProviderRollout().map((provider) => provider.chain)).toEqual([
      "kroger",
      "publix",
      "walmart",
      "aldi",
      "bjs",
    ]);
  });
});

describe("resolveProviderRolloutForStore", () => {
  it("promotes Kroger to official-api-preview when fresh official API gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Kroger Mechanicsville", {
      matchedIngredientCount: 1,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: false,
      krogerOfficialApiPromotionPassed: true,
      freshOfficialApiMatchedCount: 5,
    });

    expect(rollout.status).toBe("official-api-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("official Kroger API");
  });

  it("prefers weekly-ad promotion over official API when both gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Kroger Mechanicsville", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
      krogerOfficialApiPromotionPassed: true,
      freshOfficialApiMatchedCount: 5,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.note).toContain("weekly ad");
  });

  it("promotes Kroger to weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Kroger Mechanicsville", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("weekly ad");
  });

  it("keeps Publix coming soon when weekly-ad promotion has not passed", () => {
    const rollout = resolveProviderRolloutForStore("Publix Atlee");

    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
  });

  it("enables Publix when weekly-ad promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Publix Atlee", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
    expect(rollout.note).toContain("Rehearsal or fixture weekly-ad rows may exist");
  });

  it("keeps Walmart coming soon even when weekly-ad promotion would pass", () => {
    const rollout = resolveProviderRolloutForStore("Walmart Supercenter", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
    expect(rollout.note).toContain("Live, current weekly-ad pricing from Walmart is not available");
  });

  it("enables Aldi weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Aldi", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("weekly ad");
  });

  it("keeps Food Lion context-only when weekly-ad promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Food Lion", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
    expect(rollout.note).toContain("Rehearsal or fixture weekly-ad rows may exist");
  });

  it("keeps Food Lion context-only when weekly-ad source exists but promotion has not passed", () => {
    const rollout = resolveProviderRolloutForStore("Food Lion", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: false,
    });

    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
  });

  it("lists resolved rollout entries for promoted chains", () => {
    const rollout = listResolvedProviderRollout({
      weeklyAdPromotionByChain: {
        kroger: {
          matchedIngredientCount: 6,
          usesWeeklyAdSource: true,
          weeklyAdPromotionPassed: true,
        },
      },
    });

    expect(rollout.find((entry) => entry.chain === "kroger")?.status).toBe(
      "weekly-ad-preview",
    );
    expect(rollout.find((entry) => entry.chain === "publix")?.status).toBe(
      "coming-soon",
    );
    expect(rollout.find((entry) => entry.chain === "walmart")?.status).toBe(
      "coming-soon",
    );
  });
});
