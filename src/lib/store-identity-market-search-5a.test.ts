/**
 * Option A Slice 5a — market-search coverage expand + identity merge collapse
 * + OSM-suppress regressions (unlinked pairs must not weaken).
 */
import { describe, expect, it } from "vitest";
import type { CatalogPriceObservation, CatalogStore } from "@/lib/market-catalog-types";
import {
  createLinkedAldiOsmIdentityLookup,
  createLinkedKrogerIdentityLookup,
  FIXTURE_ALDI_CATALOG,
  FIXTURE_ALDI_OSM,
  FIXTURE_FOOD_LION_A,
  FIXTURE_FOOD_LION_B_NEARBY,
  FIXTURE_KROGER_API,
  FIXTURE_KROGER_SLUG,
} from "@/lib/fixtures/store-identity.fixtures";
import { filterMapContextCatalogStoresConflictingWithIngestedRankedChains } from "@/lib/map-osm-ranked-chain-policy";
import { buildNearbyStoresForSearch } from "@/lib/market-search-service";
import { MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES } from "@/lib/market-store-catalog-merge";
import { zip23111MechanicsvilleLocation } from "@/lib/recommendation-service-ranking.fixture";
import { collapseConfirmedIdentityLinkedCatalogStores } from "@/lib/store-identity-catalog-collapse";
import {
  expandStoreIds,
  expandStoreIdsForRead,
} from "@/lib/store-identity-resolvers";
import { buildWeeklyAdStoreCoverage } from "@/lib/weekly-ad-ingestion/weekly-ad-coverage";

const EXPAND_ON = { YUM4LESS_STORE_IDENTITY_EXPAND: "1" } as const;
const EXPAND_OFF = {} as const;

const RECIPE_INGREDIENT_IDS = [
  "chicken-thighs",
  "broccoli",
  "baby-potatoes",
  "olive-oil",
];

function weeklyAdObsOnSlug(): CatalogPriceObservation[] {
  return RECIPE_INGREDIENT_IDS.map((ingredientId, index) => ({
    storeId: FIXTURE_KROGER_SLUG.id,
    ingredientId,
    price: 4 + index,
    freshnessDaysAgo: 0,
    freshnessHoursAgo: 1,
    inStock: true,
    priceSource: "kroger-weekly-ad-scrape",
    matchConfidence: 0.9,
  }));
}

function catalogFromFixture(
  fixture: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    sourceSystem: string;
  },
  extras?: Partial<CatalogStore>,
): CatalogStore {
  return {
    id: fixture.id,
    name: fixture.name,
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: fixture.latitude,
    longitude: fixture.longitude,
    sourceName: fixture.sourceSystem,
    ...extras,
  };
}

describe("Option A Slice 5a — market-search coverage expand", () => {
  const lookup = createLinkedKrogerIdentityLookup();

  it("coverage: obs only on alias → canonical gets matches with flag ON", () => {
    const equivalent = new Set(
      expandStoreIdsForRead(lookup, [FIXTURE_KROGER_API.id], EXPAND_ON),
    );
    expect(equivalent.has(FIXTURE_KROGER_SLUG.id)).toBe(true);

    const coverage = buildWeeklyAdStoreCoverage({
      storeId: FIXTURE_KROGER_API.id,
      chain: "kroger",
      priceObservations: weeklyAdObsOnSlug(),
      recipeIngredientIds: RECIPE_INGREDIENT_IDS,
      equivalentStoreIds: equivalent,
    });

    expect(coverage.matchedIngredientCount).toBe(RECIPE_INGREDIENT_IDS.length);
    expect(coverage.usesWeeklyAdSource).toBe(true);
  });

  it("coverage: flag OFF → exact-id only (obs on alias does not count for canonical)", () => {
    const equivalent = new Set(
      expandStoreIdsForRead(lookup, [FIXTURE_KROGER_API.id], EXPAND_OFF),
    );
    expect([...equivalent]).toEqual([FIXTURE_KROGER_API.id]);

    const coverage = buildWeeklyAdStoreCoverage({
      storeId: FIXTURE_KROGER_API.id,
      chain: "kroger",
      priceObservations: weeklyAdObsOnSlug(),
      recipeIngredientIds: RECIPE_INGREDIENT_IDS,
      equivalentStoreIds: equivalent,
    });

    expect(coverage.matchedIngredientCount).toBe(0);
    expect(coverage.usesWeeklyAdSource).toBe(false);
  });

  it("fail-closed: omitting expand undercounts (exact-id regression must fail)", () => {
    const withExpand = buildWeeklyAdStoreCoverage({
      storeId: FIXTURE_KROGER_API.id,
      chain: "kroger",
      priceObservations: weeklyAdObsOnSlug(),
      recipeIngredientIds: RECIPE_INGREDIENT_IDS,
      equivalentStoreIds: new Set(
        expandStoreIdsForRead(lookup, [FIXTURE_KROGER_API.id], EXPAND_ON),
      ),
    });
    const exactIdOnly = buildWeeklyAdStoreCoverage({
      storeId: FIXTURE_KROGER_API.id,
      chain: "kroger",
      priceObservations: weeklyAdObsOnSlug(),
      recipeIngredientIds: RECIPE_INGREDIENT_IDS,
      // Deliberate omit — mirrors Slice 2 expand-bypass anti-pattern.
    });

    expect(withExpand.matchedIngredientCount).toBeGreaterThan(0);
    expect(exactIdOnly.matchedIngredientCount).toBe(0);
    expect(withExpand.matchedIngredientCount).not.toBe(
      exactIdOnly.matchedIngredientCount,
    );
  });

  it("buildNearbyStoresForSearch wires expand into coverage (flag ON)", () => {
    const stores = [
      catalogFromFixture(FIXTURE_KROGER_API, {
        sourceName: "kroger-official-api",
      }),
    ];
    const nearby = buildNearbyStoresForSearch(
      stores,
      zip23111MechanicsvilleLocation,
      12,
      weeklyAdObsOnSlug(),
      RECIPE_INGREDIENT_IDS,
      { identityLookup: lookup, env: EXPAND_ON },
    );

    expect(nearby).toHaveLength(1);
    expect(nearby[0]?.matchedIngredientCount).toBe(RECIPE_INGREDIENT_IDS.length);
  });

  it("buildNearbyStoresForSearch flag OFF stays exact-id", () => {
    const stores = [
      catalogFromFixture(FIXTURE_KROGER_API, {
        sourceName: "kroger-official-api",
      }),
    ];
    const nearby = buildNearbyStoresForSearch(
      stores,
      zip23111MechanicsvilleLocation,
      12,
      weeklyAdObsOnSlug(),
      RECIPE_INGREDIENT_IDS,
      { identityLookup: lookup, env: EXPAND_OFF },
    );

    expect(nearby[0]?.matchedIngredientCount).toBe(0);
  });

  it("Food Lion ~0.2 mi negative: expand does not link distinct storefronts", () => {
    const members = expandStoreIds(lookup, [FIXTURE_FOOD_LION_A.id]);
    expect(members).toEqual([FIXTURE_FOOD_LION_A.id]);
    expect(members).not.toContain(FIXTURE_FOOD_LION_B_NEARBY.id);
  });
});

describe("Option A Slice 5a — identity merge collapse", () => {
  const aldiLookup = createLinkedAldiOsmIdentityLookup();

  const aldiCatalog = catalogFromFixture(FIXTURE_ALDI_CATALOG, {
    sourceName: "aldi-weekly-ad-scrape",
  });
  const aldiOsm = catalogFromFixture(FIXTURE_ALDI_OSM, {
    sourceName: "openstreetmap-overpass",
  });

  it("linked Aldi+OSM → single entry at canonical with flag ON", () => {
    const collapsed = collapseConfirmedIdentityLinkedCatalogStores(
      [aldiCatalog, aldiOsm],
      aldiLookup,
      EXPAND_ON,
    );
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.id).toBe("aldi-mechanicsville");
    expect(collapsed[0]?.latitude).toBe(FIXTURE_ALDI_CATALOG.latitude);
    expect(collapsed[0]?.longitude).toBe(FIXTURE_ALDI_CATALOG.longitude);
  });

  it("unlinked Aldi+OSM → two entries (identity collapse no-op)", () => {
    const emptyLookup = createLinkedKrogerIdentityLookup();
    const collapsed = collapseConfirmedIdentityLinkedCatalogStores(
      [aldiCatalog, aldiOsm],
      emptyLookup,
      EXPAND_ON,
    );
    expect(collapsed.map((store) => store.id).sort()).toEqual([
      "aldi-mechanicsville",
      "osm-node-6531578976",
    ]);
  });

  it("flag OFF → passthrough (two entries even when linked)", () => {
    const collapsed = collapseConfirmedIdentityLinkedCatalogStores(
      [aldiCatalog, aldiOsm],
      aldiLookup,
      EXPAND_OFF,
    );
    expect(collapsed).toHaveLength(2);
  });
});

describe("Option A Slice 5a — OSM 1.5 mi suppress regressions (unlinked)", () => {
  const ingestedAldi: CatalogStore = {
    id: "aldi-mechanicsville",
    name: "Aldi",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: FIXTURE_ALDI_CATALOG.latitude,
    longitude: FIXTURE_ALDI_CATALOG.longitude,
    sourceName: "aldi-weekly-ad-scrape",
  };

  it("unlinked OSM near catalog → still suppressed via 1.5 mi logic", () => {
    // Distinct OSM id (not the seeded twin) within ranked dedupe radius.
    const unlinkedNearOsm: CatalogStore = {
      id: "osm-node-9990001",
      name: "ALDI",
      kind: "grocery",
      city: "Mechanicsville",
      state: "VA",
      latitude: FIXTURE_ALDI_CATALOG.latitude + 0.001,
      longitude: FIXTURE_ALDI_CATALOG.longitude,
      sourceName: "openstreetmap-overpass",
    };

    const result = filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
      [ingestedAldi],
      [unlinkedNearOsm],
      MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
    );

    expect(result.suppressedCount).toBe(1);
    expect(result.kept).toHaveLength(0);
  });

  it("unlinked OSM outside 1.5 mi → still present", () => {
    // ~0.017° lat ≈ 1.17 mi; use ~0.03° ≈ 2.07 mi to clear 1.5 mi.
    const unlinkedFarOsm: CatalogStore = {
      id: "osm-node-9990002",
      name: "ALDI",
      kind: "grocery",
      city: "Mechanicsville",
      state: "VA",
      latitude: FIXTURE_ALDI_CATALOG.latitude + 0.03,
      longitude: FIXTURE_ALDI_CATALOG.longitude,
      sourceName: "openstreetmap-overpass",
    };

    const result = filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
      [ingestedAldi],
      [unlinkedFarOsm],
      MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
    );

    expect(result.suppressedCount).toBe(0);
    expect(result.kept.map((store) => store.id)).toEqual(["osm-node-9990002"]);
  });

  it("identity collapse does not replace or weaken OSM suppress for unlinked pairs", () => {
    const unlinkedNearOsm: CatalogStore = {
      id: "osm-node-9990003",
      name: "ALDI",
      kind: "grocery",
      city: "Mechanicsville",
      state: "VA",
      latitude: FIXTURE_ALDI_CATALOG.latitude + 0.002,
      longitude: FIXTURE_ALDI_CATALOG.longitude,
      sourceName: "openstreetmap-overpass",
    };

    const afterSuppress =
      filterMapContextCatalogStoresConflictingWithIngestedRankedChains(
        [ingestedAldi],
        [unlinkedNearOsm],
        MAP_RANKED_CHAIN_DEDUPE_PROXIMITY_MILES,
      );

    // Kroger-only lookup: Aldi/OSM unlinked — collapse must not resurrect suppressed OSM.
    const collapsed = collapseConfirmedIdentityLinkedCatalogStores(
      [...afterSuppress.kept, ingestedAldi],
      createLinkedKrogerIdentityLookup(),
      EXPAND_ON,
    );

    expect(afterSuppress.suppressedCount).toBe(1);
    expect(collapsed.some((store) => store.id === "osm-node-9990003")).toBe(
      false,
    );
    expect(collapsed.map((store) => store.id)).toEqual(["aldi-mechanicsville"]);
  });
});
