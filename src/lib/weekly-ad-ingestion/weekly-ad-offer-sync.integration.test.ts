import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbPoolForTests } from "@/lib/db";
import { deletePriceObservationsForStore } from "@/lib/price-observation-writes";
import {
  countLivePriceObservationsForStore,
  getMarketDataSnapshot,
} from "@/lib/market-repository";
import { runWeeklyAdIngestionForStores } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import {
  buildWeeklyAdStoreCoverage,
  weeklyAdPromotionGatesPass,
} from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";
import { resolveProviderRolloutForStore } from "@/lib/provider-rollout";

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

describe("weekly ad ingest to ranked pricing (integration)", () => {
  beforeEach(async () => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
    await deletePriceObservationsForStore("kroger-mechanicsville");
  });

  afterEach(async () => {
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
    await resetDbPoolForTests();
  });

  it("syncs Kroger fixture offers and passes weekly-ad promotion gates", async () => {
    const { syncSummaries } = await runWeeklyAdIngestionForStores({
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger Mechanicsville",
          chain: "kroger",
        },
      ],
      zipCode: "23111",
      persistToDatabase: true,
    });

    expect(syncSummaries[0]?.syncedCount).toBeGreaterThan(0);

    const { snapshot } = await getMarketDataSnapshot();
    const recipeIngredientIds = [
      ...new Set(
        snapshot.recipes.flatMap((recipe) =>
          recipe.ingredients.map((ingredient) => ingredient.ingredientId),
        ),
      ),
    ];

    const scrapedObservations = snapshot.priceObservations.filter(
      (observation) =>
        observation.storeId === "kroger-mechanicsville" &&
        observation.priceSource === "kroger-weekly-ad-scrape",
    );
    expect(scrapedObservations.length).toBeGreaterThan(0);

    const coverage = buildWeeklyAdStoreCoverage({
      storeId: "kroger-mechanicsville",
      chain: "kroger",
      priceObservations: snapshot.priceObservations,
      recipeIngredientIds,
    });

    expect(weeklyAdPromotionGatesPass(coverage, "kroger")).toBe(true);

    const rollout = resolveProviderRolloutForStore("Kroger Mechanicsville", {
      matchedIngredientCount: coverage.matchedIngredientCount,
      usesWeeklyAdSource: coverage.usesWeeklyAdSource,
      weeklyAdPromotionPassed: weeklyAdPromotionGatesPass(coverage, "kroger"),
    });

    expect(rollout.status).toBe("weekly-ad-preview");
    expect(rollout.recommendationEnabled).toBe(true);
  });

  it("skips duplicate observations when an identical fixture ingest runs twice", async () => {
    const ingestInput = {
      nearbyStores: [
        {
          id: "kroger-mechanicsville",
          name: "Kroger Mechanicsville",
          chain: "kroger" as const,
        },
      ],
      zipCode: "23111",
      persistToDatabase: true,
    };

    const firstRun = await runWeeklyAdIngestionForStores(ingestInput);
    expect(firstRun.syncSummaries[0]?.syncedCount).toBeGreaterThan(0);

    const countAfterFirst = await countLivePriceObservationsForStore(
      "kroger-mechanicsville",
    );
    expect(countAfterFirst).toBeGreaterThan(0);

    const secondRun = await runWeeklyAdIngestionForStores(ingestInput);
    expect(secondRun.syncSummaries[0]?.syncedCount).toBe(0);
    expect(secondRun.syncSummaries[0]?.skippedCount).toBeGreaterThan(0);

    const countAfterSecond = await countLivePriceObservationsForStore(
      "kroger-mechanicsville",
    );
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
