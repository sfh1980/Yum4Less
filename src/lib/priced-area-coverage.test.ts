import { describe, expect, it } from "vitest";
import { buildTestNearbyStoreSummary } from "@/lib/test-fixtures/contract-fixtures";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";
import {
  PRICED_AREA_LABEL_UNSET,
  pricedAreaCoverageSentence,
  readPricedAreaCoverageSentence,
  readPricedAreaLabel,
  tierCMapOnlyReason,
  UNSET_PRICED_AREA_COVERAGE_SENTENCE,
} from "@/lib/priced-area-coverage";

const stores = [buildTestNearbyStoreSummary({ id: "store-a", name: "Store A" })];

describe("priced area coverage sentence", () => {
  it("uses neutral wording when the setting is unset", () => {
    expect(readPricedAreaLabel(buildTestProcessEnv())).toBeNull();
    expect(readPricedAreaCoverageSentence(buildTestProcessEnv())).toBe(
      UNSET_PRICED_AREA_COVERAGE_SENTENCE,
    );
    expect(UNSET_PRICED_AREA_COVERAGE_SENTENCE).toBe(
      `Dinner price estimates are available today in ${PRICED_AREA_LABEL_UNSET}. Elsewhere you will see nearby stores while coverage grows.`,
    );
    expect(UNSET_PRICED_AREA_COVERAGE_SENTENCE).not.toMatch(/richmond|virginia|\d{5}/i);
  });

  it("uses the owner setting when it is a short place phrase", () => {
    const env = buildTestProcessEnv({ YUM4LESS_PRICED_AREA_LABEL: "  the example area  " });
    expect(readPricedAreaLabel(env)).toBe("the example area");
    expect(readPricedAreaCoverageSentence(env)).toBe(
      pricedAreaCoverageSentence("the example area"),
    );
    expect(readPricedAreaCoverageSentence(env)).toContain("in the example area.");
  });

  it("ignores a blank, oversized, or markup-like setting", () => {
    expect(readPricedAreaLabel(buildTestProcessEnv({ YUM4LESS_PRICED_AREA_LABEL: "   " }))).toBeNull();
    expect(
      readPricedAreaLabel(buildTestProcessEnv({ YUM4LESS_PRICED_AREA_LABEL: "x".repeat(81) })),
    ).toBeNull();
    expect(
      readPricedAreaLabel(buildTestProcessEnv({ YUM4LESS_PRICED_AREA_LABEL: "<b>area</b>" })),
    ).toBeNull();
    expect(
      readPricedAreaCoverageSentence(
        buildTestProcessEnv({ YUM4LESS_PRICED_AREA_LABEL: "<b>area</b>" }),
      ),
    ).toBe(UNSET_PRICED_AREA_COVERAGE_SENTENCE);
  });
});

describe("tier C map-only reason", () => {
  it("reuses the existing no-priced-stores reason and leaves other outcomes alone", () => {
    const reason = tierCMapOnlyReason({
      dataSource: "database",
      nearbyStores: stores,
      recommendationReadyStoreCount: 0,
    });
    expect(reason).toBe(
      "Yum4Less found nearby stores, but none have enough sale prices for dinner estimates right now. Other map pins may be for planning only.",
    );

    expect(
      tierCMapOnlyReason({
        dataSource: "database",
        nearbyStores: stores,
        recommendationReadyStoreCount: 2,
      }),
    ).toBeNull();
    expect(
      tierCMapOnlyReason({
        dataSource: "database",
        nearbyStores: [],
        recommendationReadyStoreCount: 0,
      }),
    ).toBeNull();
    expect(
      tierCMapOnlyReason({
        dataSource: "unavailable",
        nearbyStores: stores,
        recommendationReadyStoreCount: 0,
      }),
    ).toBeNull();
  });
});
