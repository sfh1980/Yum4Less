import { describe, expect, it } from "vitest";
import {
  getProviderRolloutForCatalogStore,
  getProviderRolloutForStore,
  listProviderRollout,
  resolveProviderRolloutForCatalogStore,
  resolveProviderRolloutForStore,
  listResolvedProviderRollout,
} from "@/lib/provider-rollout";

describe("provider rollout", () => {
  it("labels Kroger with shopper-facing estimates copy before promotion passes", () => {
    const rollout = getProviderRolloutForStore("Kroger Mechanicsville");

    expect(rollout.chain).toBe("kroger");
    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
    expect(rollout.note).toContain("saved sale prices");
    expect(rollout.note).toContain("verify in store");
  });

  it("labels Aldi with shopper-facing estimates copy before promotion passes", () => {
    const rollout = getProviderRolloutForStore("Aldi");

    expect(rollout.chain).toBe("aldi");
    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
    expect(rollout.note).toContain("saved sale prices");
    expect(rollout.note).toContain("verify in store");
  });

  it("maps Kroger-family banner names to the Kroger rollout", () => {
    expect(getProviderRolloutForStore("Harris Teeter").chain).toBe("kroger");
    expect(getProviderRolloutForStore("Ralphs").chain).toBe("kroger");
  });

  it("labels Walmart with shopper-facing estimates copy before promotion passes", () => {
    const rollout = getProviderRolloutForStore("Walmart Supercenter");

    expect(rollout.chain).toBe("walmart");
    expect(rollout.note).toContain("saved sale prices");
    expect(rollout.note).toContain("verify in store");
  });

  it("labels Lidl with shopper-facing estimates copy before promotion passes", () => {
    const rollout = getProviderRolloutForStore("Lidl");

    expect(rollout.chain).toBe("lidl");
    expect(rollout.note).toContain("saved sale prices");
    expect(rollout.note).toContain("verify in store");
  });

  it("lists catalog rollout entries for shopper-facing chains", () => {
    expect(listProviderRollout().map((provider) => provider.chain)).toEqual([
      "kroger",
      "aldi",
      "publix",
      "food-lion",
      "lidl",
      "walmart",
      "bjs",
    ]);
  });

  it("resolves catalog stores with locator display names to the correct rollout", () => {
    const rollout = getProviderRolloutForCatalogStore({
      id: "publix-1626",
      name: "Brandy Creek Commons",
      sourceName: "publix-store-locator",
    });

    expect(rollout.chain).toBe("publix");
    expect(rollout.label).toBe("Publix");
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
    expect(rollout.note).toContain("recently checked online store prices");
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
    expect(rollout.note).toContain("saved sale prices");
  });

  it("promotes Kroger to weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Kroger Mechanicsville", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("saved sale prices");
  });

  it("keeps Publix coming soon when weekly-ad promotion has not passed", () => {
    const rollout = resolveProviderRolloutForStore("Publix Atlee");

    expect(rollout.status).toBe("coming-soon");
    expect(rollout.recommendationEnabled).toBe(false);
  });

  it("enables Publix weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForCatalogStore(
      {
        id: "publix-1626",
        name: "Brandy Creek Commons",
        sourceName: "publix-store-locator",
      },
      {
        matchedIngredientCount: 4,
        usesWeeklyAdSource: true,
        weeklyAdPromotionPassed: true,
      },
    );

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("saved sale prices");
  });

  it("promotes Walmart to weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Walmart Supercenter", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("saved sale prices");
  });

  it("enables Aldi weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Aldi", {
      matchedIngredientCount: 6,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("saved sale prices");
  });

  it("enables Food Lion weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Food Lion", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("saved sale prices");
  });

  it("enables Lidl weekly-ad-preview when promotion gates pass", () => {
    const rollout = resolveProviderRolloutForStore("Lidl", {
      matchedIngredientCount: 5,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: true,
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
    expect(rollout.note).toContain("saved sale prices");
  });

  it("keeps Food Lion limited when weekly-ad source exists but promotion has not passed", () => {
    const rollout = resolveProviderRolloutForStore("Food Lion", {
      matchedIngredientCount: 4,
      usesWeeklyAdSource: true,
      weeklyAdPromotionPassed: false,
    });

    expect(rollout.status).toBe("limited-coverage");
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
    expect(rollout.find((entry) => entry.chain === "aldi")?.status).toBe(
      "coming-soon",
    );
    expect(rollout.find((entry) => entry.chain === "lidl")?.status).toBe(
      "coming-soon",
    );
    expect(rollout.find((entry) => entry.chain === "walmart")?.status).toBe(
      "coming-soon",
    );
  });

  it("lists resolved Walmart as weekly-ad-preview when that chain's gates pass", () => {
    const rollout = listResolvedProviderRollout({
      weeklyAdPromotionByChain: {
        walmart: {
          matchedIngredientCount: 6,
          usesWeeklyAdSource: true,
          weeklyAdPromotionPassed: true,
        },
      },
    });

    expect(rollout.find((entry) => entry.chain === "walmart")?.status).toBe(
      "weekly-ad-preview",
    );
    expect(rollout.find((entry) => entry.chain === "walmart")?.recommendationEnabled).toBe(
      true,
    );
  });
});
