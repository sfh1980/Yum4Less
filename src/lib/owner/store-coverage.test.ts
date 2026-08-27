import { describe, expect, it } from "vitest";
import {
  buildStoreCoverageRow,
  filterStoreCoverageRows,
  matchRegistryChainId,
  summarizeStoreCoverage,
  type ChainRegistryRow,
  type StoreCoverageSourceRow,
} from "@/lib/owner/store-coverage";

const registry: ChainRegistryRow[] = [
  {
    chainId: "kroger",
    displayName: "Kroger",
    rolloutStage: "ranked",
    shopperRanked: true,
    settingsSelectable: true,
    weeklyAdEligible: true,
    promotionBlocked: false,
    flippMerchantName: "Kroger",
    primaryStoreIdPrefixes: ["kroger-"],
    nameMatchFragments: ["kroger"],
    locationStrategy: "kroger_api",
    saleDiscoveryStrategy: "hybrid",
    officialPricingAdapter: "kroger-official-api",
    weeklyAdAdapter: "kroger-weekly-ad",
    sortOrder: 10,
    notes: null,
  },
  {
    chainId: "walmart",
    displayName: "Walmart",
    rolloutStage: "ranked",
    shopperRanked: true,
    settingsSelectable: true,
    weeklyAdEligible: true,
    promotionBlocked: false,
    flippMerchantName: "Walmart",
    primaryStoreIdPrefixes: ["walmart-"],
    nameMatchFragments: ["walmart"],
    locationStrategy: "map_catalog_only",
    saleDiscoveryStrategy: "hybrid",
    officialPricingAdapter: null,
    weeklyAdAdapter: "walmart-weekly-ad",
    sortOrder: 60,
    notes: null,
  },
  {
    chainId: "whole-foods",
    displayName: "Whole Foods",
    rolloutStage: "upcoming",
    shopperRanked: false,
    settingsSelectable: false,
    weeklyAdEligible: false,
    promotionBlocked: false,
    flippMerchantName: null,
    primaryStoreIdPrefixes: ["whole-foods-"],
    nameMatchFragments: ["whole foods"],
    locationStrategy: "map_catalog_only",
    saleDiscoveryStrategy: "none",
    officialPricingAdapter: null,
    weeklyAdAdapter: null,
    sortOrder: 120,
    notes: null,
  },
];

function store(
  overrides: Partial<StoreCoverageSourceRow> & Pick<StoreCoverageSourceRow, "storeId" | "name">,
): StoreCoverageSourceRow {
  return {
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6,
    longitude: -77.3,
    sourceName: "openstreetmap-overpass",
    sourceStoreId: null,
    seen: true,
    mapped: true,
    freshSaleCount: 0,
    lastSaleAt: null,
    ...overrides,
  };
}

describe("store coverage matching", () => {
  it("matches Whole Foods OSM pins via registry fragments", () => {
    expect(
      matchRegistryChainId(
        store({ storeId: "osm-node-1", name: "Whole Foods Market" }),
        registry,
      ),
    ).toBe("whole-foods");
  });

  it("keeps Kroger catalog ids on the kroger registry row", () => {
    expect(
      matchRegistryChainId(
        store({
          storeId: "kroger-02900529",
          name: "Kroger",
          sourceName: "kroger-official-api",
        }),
        registry,
      ),
    ).toBe("kroger");
  });
});

describe("buildStoreCoverageRow", () => {
  it("marks ranked chains with fresh sales as usable in the app", () => {
    const row = buildStoreCoverageRow(
      store({
        storeId: "kroger-mechanicsville",
        name: "Kroger",
        sourceName: "kroger-weekly-ad-scrape",
        freshSaleCount: 12,
      }),
      registry,
    );
    expect(row.sales).toBe(true);
    expect(row.usableInApp).toBe(true);
  });

  it("treats Walmart sale rows as usable when the banner is shopper-ranked", () => {
    const row = buildStoreCoverageRow(
      store({
        storeId: "walmart-23111",
        name: "Walmart",
        sourceName: "walmart-weekly-ad-scrape",
        freshSaleCount: 14,
      }),
      registry,
    );
    expect(row.sales).toBe(true);
    expect(row.usableInApp).toBe(true);
  });
});

describe("filterStoreCoverageRows", () => {
  const rows = [
    buildStoreCoverageRow(
      store({
        storeId: "kroger-mechanicsville",
        name: "Kroger",
        sourceName: "kroger-weekly-ad-scrape",
        city: "Mechanicsville",
        freshSaleCount: 8,
      }),
      registry,
    ),
    buildStoreCoverageRow(
      store({
        storeId: "osm-node-7eleven",
        name: "7-Eleven",
        city: "Richmond",
        state: "VA",
      }),
      registry,
    ),
  ];

  it("filters by store name and usable-in-app", () => {
    expect(
      filterStoreCoverageRows(rows, { nameQuery: "kroger", usable: "yes" }).map(
        (row) => row.storeId,
      ),
    ).toEqual(["kroger-mechanicsville"]);
  });

  it("filters by city or state", () => {
    expect(
      filterStoreCoverageRows(rows, { locationQuery: "richmond" }).map((row) => row.storeId),
    ).toEqual(["osm-node-7eleven"]);
  });
});

describe("summarizeStoreCoverage", () => {
  it("counts mapped vs sales vs usable per registry chain", () => {
    const rows = [
      buildStoreCoverageRow(
        store({
          storeId: "kroger-1",
          name: "Kroger",
          sourceName: "kroger-official-api",
          freshSaleCount: 4,
        }),
        registry,
      ),
      buildStoreCoverageRow(
        store({ storeId: "osm-wawa", name: "Wawa" }),
        registry,
      ),
    ];
    const summaries = summarizeStoreCoverage(rows, registry);
    const kroger = summaries.find((row) => row.chainId === "kroger");
    const other = summaries.find((row) => row.chainId === "unknown");
    expect(kroger).toMatchObject({ storeCount: 1, salesCount: 1, usableCount: 1 });
    expect(other).toMatchObject({ storeCount: 1, usableCount: 0 });
  });
});
