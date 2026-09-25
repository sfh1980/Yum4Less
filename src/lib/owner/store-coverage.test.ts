import { describe, expect, it } from "vitest";
import type { GeoJsonPolygon } from "@/lib/geo/point-in-polygon";
import {
  buildStoreCoverageRow,
  collapseSamePlaceCoverageRows,
  filterStoreCoverageRows,
  matchRegistryChainId,
  summarizeStoreCoverage,
  visibleTrackedBannerSummaries,
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
    expect(
      filterStoreCoverageRows(rows, { usable: "all", chainId: "kroger" }).map(
        (row) => row.storeId,
      ),
    ).toEqual(["kroger-mechanicsville"]);
  });

  it("filters by city or state", () => {
    expect(
      filterStoreCoverageRows(rows, { locationQuery: "richmond" }).map((row) => row.storeId),
    ).toEqual(["osm-node-7eleven"]);
  });

  it("filters a 5-digit ZIP by map shape so Richmond is not Mechanicsville", () => {
    const squareAroundMechanicsville: GeoJsonPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [-77.4, 37.58],
          [-77.2, 37.58],
          [-77.2, 37.65],
          [-77.4, 37.65],
          [-77.4, 37.58],
        ],
      ],
    };
    const richmond = buildStoreCoverageRow(
      store({
        storeId: "kroger-lombardy",
        name: "Kroger",
        city: "Richmond",
        latitude: 37.569,
        longitude: -77.466,
      }),
      registry,
    );
    const mechanicsville = rows[0]!;
    const matched = filterStoreCoverageRows([richmond, mechanicsville], {
      zipFence: {
        zipCode: "23111",
        center: { latitude: 37.6085, longitude: -77.3739 },
        geometry: squareAroundMechanicsville,
        radiusMiles: 26,
      },
    });
    expect(matched.map((row) => row.storeId)).toEqual(["kroger-mechanicsville"]);
    expect(matched[0]?.zipCode).toBe("23111");
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

describe("visibleTrackedBannerSummaries", () => {
  it("keeps tracked banners that have stores in the current search", () => {
    const visible = visibleTrackedBannerSummaries([
      {
        chainId: "kroger",
        chainLabel: "Kroger",
        rolloutStage: "ranked",
        storeCount: 2,
        mappedCount: 2,
        salesCount: 1,
        usableCount: 1,
      },
      {
        chainId: "aldi",
        chainLabel: "Aldi",
        rolloutStage: "ranked",
        storeCount: 0,
        mappedCount: 0,
        salesCount: 0,
        usableCount: 0,
      },
      {
        chainId: "unknown",
        chainLabel: "Other / untracked",
        rolloutStage: "upcoming",
        storeCount: 4,
        mappedCount: 0,
        salesCount: 0,
        usableCount: 0,
      },
    ]);
    expect(visible.map((row) => row.chainId)).toEqual(["kroger"]);
  });
});

describe("collapseSamePlaceCoverageRows", () => {
  it("keeps one row when a map pin and a retailer pin are the same building", () => {
    const mapPin = buildStoreCoverageRow(
      store({
        storeId: "osm-way-252997411",
        name: "Whole Foods Market",
        city: "Richmond",
        sourceName: "openstreetmap-overpass",
        sourceStoreId: "osm-way-252997411",
        latitude: 37.557872,
        longitude: -77.461292,
      }),
      registry,
    );
    const retailerPin = buildStoreCoverageRow(
      store({
        storeId: "whole-foods-10598",
        name: "Whole Foods West Broad Street",
        city: "Richmond",
        sourceName: "whole-foods-weekly-ad-scrape",
        sourceStoreId: "10598",
        latitude: 37.55818,
        longitude: -77.461295,
        freshSaleCount: 4,
      }),
      registry,
    );

    const collapsed = collapseSamePlaceCoverageRows([mapPin, retailerPin]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.storeId).toBe("whole-foods-10598");
    expect(collapsed[0]?.sales).toBe(true);
    expect(collapsed[0]?.samePlaceNote).toBe("Same place as Whole Foods Market");
  });
});
