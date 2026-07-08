import { describe, expect, it } from "vitest";
import { getDistanceMiles } from "@/lib/geo-distance";
import {
  CATALOG_COLLOCATED_MERGE_MILES,
  collapseSameChainCollocatedCatalogStores,
  KROGER_COLLOCATED_MERGE_MILES,
  preferCollocatedCatalogStoreId,
  resolveCollocatedCatalogUpsertTarget,
  resolveCollocatedMergeRadiusMiles,
  scoreCollocatedCatalogStorePriority,
  storesAreCollocatedCatalogDuplicates,
  type CollocatedCatalogStoreLike,
} from "@/lib/catalog-store-colocated-identity";

const ANCHOR = { latitude: 37.61546, longitude: -77.32939 };
/** ~0.10 mi north of ANCHOR — between 0.05 and 0.15. */
const NEAR_LAT = ANCHOR.latitude + 0.00145;

function pairAtZeroPointOneMiles(chain: "kroger" | "aldi" | "food-lion" | "publix"): {
  left: CollocatedCatalogStoreLike;
  right: CollocatedCatalogStoreLike;
  miles: number;
} {
  const left: CollocatedCatalogStoreLike = {
    id: `${chain}-slug`,
    name: chain === "food-lion" ? "Food Lion" : chain === "aldi" ? "Aldi" : chain === "publix" ? "Publix" : "Kroger",
    chain,
    latitude: ANCHOR.latitude,
    longitude: ANCHOR.longitude,
    sourceName:
      chain === "kroger"
        ? "kroger-weekly-ad-scrape"
        : chain === "aldi"
          ? "aldi-weekly-ad-scrape"
          : chain === "publix"
            ? "publix-weekly-ad-scrape"
            : "food-lion-weekly-ad-scrape",
  };
  const right: CollocatedCatalogStoreLike = {
    id: chain === "kroger" ? "kroger-02900999" : `${chain}-23111`,
    name: left.name,
    chain,
    latitude: NEAR_LAT,
    longitude: ANCHOR.longitude,
    sourceName:
      chain === "kroger" ? "kroger-official-api" : "yum4less-market-catalog",
    sourceStoreId: chain === "kroger" ? "02900999" : undefined,
  };
  return {
    left,
    right,
    miles: getDistanceMiles(
      left.latitude,
      left.longitude,
      right.latitude,
      right.longitude,
    ),
  };
}

describe("catalog-store-colocated-identity", () => {
  it("exposes Decision A thresholds: 0.05 default and Kroger 0.15 exception", () => {
    expect(CATALOG_COLLOCATED_MERGE_MILES).toBe(0.05);
    expect(KROGER_COLLOCATED_MERGE_MILES).toBe(0.15);
    expect(resolveCollocatedMergeRadiusMiles("kroger")).toBe(0.15);
    expect(resolveCollocatedMergeRadiusMiles("aldi")).toBe(0.05);
    expect(resolveCollocatedMergeRadiusMiles("publix")).toBe(0.05);
    expect(resolveCollocatedMergeRadiusMiles("food-lion")).toBe(0.05);
  });

  it("scores API / weekly-ad / slug / ZIP-market priority order", () => {
    expect(
      scoreCollocatedCatalogStorePriority({
        id: "kroger-02900529",
        name: "Kroger",
        latitude: 0,
        longitude: 0,
        sourceName: "kroger-official-api",
        sourceStoreId: "02900529",
      }),
    ).toBeGreaterThan(
      scoreCollocatedCatalogStorePriority({
        id: "aldi-mechanicsville",
        name: "Aldi",
        latitude: 0,
        longitude: 0,
        sourceName: "aldi-weekly-ad-scrape",
      }),
    );
    expect(
      scoreCollocatedCatalogStorePriority({
        id: "aldi-mechanicsville",
        name: "Aldi",
        latitude: 0,
        longitude: 0,
        sourceName: "aldi-weekly-ad-scrape",
      }),
    ).toBeGreaterThan(
      scoreCollocatedCatalogStorePriority({
        id: "aldi-23111",
        name: "Aldi",
        latitude: 0,
        longitude: 0,
        sourceName: "yum4less-market-catalog",
      }),
    );
    expect(
      preferCollocatedCatalogStoreId(
        {
          id: "aldi-23111",
          name: "Aldi",
          latitude: 37.611,
          longitude: -77.336,
          sourceName: "yum4less-market-catalog",
        },
        {
          id: "aldi-mechanicsville",
          name: "Aldi",
          latitude: 37.611,
          longitude: -77.336,
          sourceName: "aldi-weekly-ad-scrape",
        },
      ),
    ).toBe("aldi-mechanicsville");
  });

  it("PINNED: ~0.10 mi pair merges for Kroger (0.15) but not for non-Kroger (0.05)", () => {
    const kroger = pairAtZeroPointOneMiles("kroger");
    expect(kroger.miles).toBeGreaterThan(0.05);
    expect(kroger.miles).toBeLessThan(0.15);

    expect(
      storesAreCollocatedCatalogDuplicates(kroger.left, kroger.right),
    ).toBe(true);
    expect(
      collapseSameChainCollocatedCatalogStores([kroger.left, kroger.right]).map(
        (row) => row.id,
      ),
    ).toEqual(["kroger-02900999"]);

    for (const chain of ["aldi", "food-lion", "publix"] as const) {
      const pair = pairAtZeroPointOneMiles(chain);
      expect(pair.miles).toBeGreaterThan(0.05);
      expect(pair.miles).toBeLessThan(0.15);
      expect(storesAreCollocatedCatalogDuplicates(pair.left, pair.right)).toBe(
        false,
      );
      expect(
        collapseSameChainCollocatedCatalogStores([pair.left, pair.right]).map(
          (row) => row.id,
        ),
      ).toEqual([pair.left.id, pair.right.id]);
    }
  });

  it("resolveCollocatedCatalogUpsertTarget redirects ZIP twin onto collocated slug", () => {
    const target = resolveCollocatedCatalogUpsertTarget(
      {
        id: "aldi-23111",
        name: "Aldi",
        chain: "aldi",
        latitude: 37.611004,
        longitude: -77.336853,
        sourceName: "yum4less-market-catalog",
        sourceStoreId: "osm-node-6531578976",
      },
      [
        {
          id: "aldi-mechanicsville",
          name: "Aldi",
          chain: "aldi",
          latitude: 37.611004,
          longitude: -77.336853,
          sourceName: "aldi-weekly-ad-scrape",
        },
      ],
    );

    expect(target.shouldCreateCandidateId).toBe(false);
    expect(target.storeId).toBe("aldi-mechanicsville");
  });
});
