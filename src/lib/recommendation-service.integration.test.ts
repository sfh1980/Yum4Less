import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { deleteAllPriceObservations } from "@/lib/test-only/price-observation-writes";
import { getProviderRolloutForCatalogStore } from "@/lib/provider-rollout";
import {
  getMarketSearchExperience,
  getRecommendationExperience,
} from "@/lib/recommendation-service";
import {
  zip23111MechanicsvilleLocation,
  zip23111RankingPreferences,
} from "@/lib/recommendation-service-ranking.fixture";
import type { SaleConfidenceLevel } from "@/lib/sale-confidence";
import {
  isWeeklyAdChain,
  runWeeklyAdIngestionForStores,
} from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-service";
import type { WeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const { buildProviderPricingPreviews, searchOfficialProviderStores } = vi.hoisted(
  () => ({
    buildProviderPricingPreviews: vi.fn(),
    searchOfficialProviderStores: vi.fn(),
  }),
);

vi.mock("@/lib/provider-pricing-preview-service", () => ({
  buildProviderPricingPreviews,
}));

vi.mock("@/lib/provider-market-service", () => ({
  searchOfficialProviderStores,
}));

const FRESHNESS_LABELS = [
  "Checked within 1 hour",
  "Same-day online prices",
  "Recent sale prices",
  "Older prices — verify in store",
] as const;

const CONFIDENCE_LABELS = ["Single-store estimate", "Multi-store estimate"] as const;

const WEEKLY_AD_SALE_LEVELS: SaleConfidenceLevel[] = [
  "advertised-recent",
  "advertised-aging",
  "advertised-stale",
  "directional-provider-match",
];

const originalFixtureFlag = process.env.YUM4LESS_WEEKLY_AD_FIXTURE;

async function ingestFixtureWeeklyAdsFromSeedCatalog() {
  const { snapshot } = await getMarketDataSnapshot();
  const nearbyStores = snapshot.stores
    .map((store) => {
      const rollout = getProviderRolloutForCatalogStore(store);
      return {
        id: store.id,
        name: store.name,
        chain: rollout.chain,
      };
    })
    .filter(
      (store): store is { id: string; name: string; chain: WeeklyAdChain } =>
        isWeeklyAdChain(store.chain),
    );

  return runWeeklyAdIngestionForStores({
    nearbyStores,
    zipCode: "23111",
    persistToDatabase: true,
  });
}

function assertTrustFieldsOnMeal(
  meal: Awaited<ReturnType<typeof getRecommendationExperience>>["recommendations"][number],
) {
  expect(FRESHNESS_LABELS).toContain(meal.freshnessLabel);
  expect(CONFIDENCE_LABELS).toContain(meal.confidenceLabel);
  expect(meal.explanation.length).toBeGreaterThan(0);
  expect(meal.shoppingPlan.length).toBeGreaterThan(0);

  for (const line of meal.shoppingPlan) {
    expect(line.priceSource).toMatch(/-weekly-ad-scrape$/);
    expect(WEEKLY_AD_SALE_LEVELS).toContain(line.saleConfidence.level);
    expect(line.saleConfidence.label.length).toBeGreaterThan(0);
    expect(line.saleConfidence.note.length).toBeGreaterThan(0);
  }
}

/**
 * CI-06 merge gate: fixture ingest (or seeded catalog) → Postgres snapshot →
 * market search + ranked meals with trust fields. Provider HTTP is mocked off.
 */
describe("recommendation path through Postgres (CI-06)", () => {
  beforeEach(async () => {
    process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
    buildProviderPricingPreviews.mockReset();
    buildProviderPricingPreviews.mockResolvedValue([]);
    searchOfficialProviderStores.mockReset();
    searchOfficialProviderStores.mockResolvedValue([]);

    const pool = getDbPool();
    await pool.query(
      `delete from store_identity_aliases where identity_id = 'kroger-02900529'
          or store_id like 'kroger-%'`,
    );
    await pool.query(
      `delete from store_identities where id = 'kroger-02900529' or id like 'kroger-%'`,
    );
    await pool.query(
      `delete from stores where source_name = 'kroger-official-api' and id <> 'kroger-mechanicsville'`,
    );
    await pool.query(`
      update stores
      set
        name = 'Kroger',
        source_name = 'yum4less-internal-catalog',
        source_store_id = 'kroger-mechanicsville'
      where id = 'kroger-mechanicsville'
    `);

    await deleteAllPriceObservations();
    const ingest = await ingestFixtureWeeklyAdsFromSeedCatalog();
    const syncedTotal = ingest.syncSummaries.reduce(
      (sum, summary) => sum + summary.syncedCount,
      0,
    );
    expect(syncedTotal).toBeGreaterThan(0);
  });

  afterEach(async () => {
    if (originalFixtureFlag === undefined) {
      delete process.env.YUM4LESS_WEEKLY_AD_FIXTURE;
    } else {
      process.env.YUM4LESS_WEEKLY_AD_FIXTURE = originalFixtureFlag;
    }
    await resetDbPoolForTests();
  });

  it("loads seed stores (plus optional map-catalog rows) and fixture price rows from Postgres", async () => {
    const { snapshot, source } = await getMarketDataSnapshot();

    expect(source).toBe("database");
    expect(snapshot.stores.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.recipes.length).toBeGreaterThan(0);
    expect(snapshot.priceObservations.length).toBeGreaterThan(0);
    expect(
      snapshot.priceObservations.some(
        (row) => row.priceSource === "kroger-weekly-ad-scrape",
      ),
    ).toBe(true);
  });

  it("runs market search and ranked meals with trust fields after fixture ingest", async () => {
    const { market } = await getMarketSearchExperience(
      zip23111RankingPreferences.radiusMiles,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(market.dataSource).toBe("database");
    expect(market.nearbyStores.length).toBeGreaterThan(0);
    expect(market.recommendationReadyStoreCount).toBeGreaterThan(0);
    expect(
      market.nearbyStores.some(
        (store) =>
          store.id === "kroger-mechanicsville" &&
          store.rolloutStatus === "weekly-ad-preview" &&
          store.recommendationEnabled,
      ),
    ).toBe(true);
    const walmartStore = market.nearbyStores.find(
      (store) => store.id === "walmart-rocketts",
    );
    if (walmartStore) {
      expect(walmartStore.chain).toBe("walmart");
      if (walmartStore.recommendationEnabled) {
        expect(walmartStore.rolloutStatus).toBe("weekly-ad-preview");
      } else {
        expect(["coming-soon", "limited-coverage"]).toContain(
          walmartStore.rolloutStatus,
        );
      }
    }
    expect(searchOfficialProviderStores).toHaveBeenCalled();
    expect(buildProviderPricingPreviews).toHaveBeenCalled();

    const experience = await getRecommendationExperience(
      zip23111RankingPreferences,
      zip23111MechanicsvilleLocation,
      false,
    );

    expect(experience.market.dataSource).toBe("database");
    // Fixture Kroger rows fully cover sheet-pan chicken single-store; Walmart
    // fixture prices can rank when weekly-ad floors pass.
    expect(experience.recommendations.length).toBeGreaterThanOrEqual(1);

    const scores = experience.recommendations.map((meal) => meal.score.total);
    for (let index = 1; index < experience.recommendations.length; index += 1) {
      // Ranking is descending; equal totals are allowed (ties are not a failure).
      expect(scores[index - 1]!).toBeGreaterThanOrEqual(scores[index]!);
    }

    const totals = experience.recommendations.map((meal) => meal.estimatedTotal);
    for (let index = 1; index < totals.length; index += 1) {
      expect(totals[index - 1]!).toBeLessThanOrEqual(totals[index]!);
    }

    for (const meal of experience.recommendations) {
      expect(meal.estimatedTotal).toBeLessThanOrEqual(
        zip23111RankingPreferences.budget,
      );
      expect(meal.shoppingPlan.length).toBeLessThanOrEqual(
        zip23111RankingPreferences.maxIngredients,
      );
      assertTrustFieldsOnMeal(meal);
    }

    const topMeal = experience.recommendations[0];
    expect(topMeal?.title).toBe("Sheet Pan Lemon Chicken and Vegetables");
    expect(topMeal?.storeCount).toBe(1);
    expect(topMeal?.shoppingPlan.every((item) => item.storeName! === "Kroger")).toBe(
      true,
    );
    expect(
      experience.recommendations.every((meal) =>
        meal.shoppingPlan.every((item) => !item.storeName!.includes("Walmart")),
      ),
    ).toBe(true);
    expect(CONFIDENCE_LABELS).toContain(topMeal?.confidenceLabel);
  });
});
