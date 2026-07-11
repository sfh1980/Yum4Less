import { describe, expect, it } from "vitest";
import {
  assertFixtureDistances,
  createLinkedAldiOsmIdentityLookup,
  createLinkedKrogerIdentityLookup,
  FIXTURE_ALDI_CATALOG,
  FIXTURE_ALDI_OSM,
  FIXTURE_FOOD_LION_A,
  FIXTURE_FOOD_LION_B_NEARBY,
  FIXTURE_KROGER_API,
  FIXTURE_KROGER_SLUG,
} from "@/lib/fixtures/store-identity.fixtures";
import {
  STORE_IDENTITY_CONFIRM_THRESHOLD,
  STORE_IDENTITY_HARD_MILES,
  STORE_IDENTITY_PROVISIONAL_THRESHOLD,
  STORE_IDENTITY_SOFT_MILES,
  scoreStoreIdentityMatch,
  scoreStoreIdentityPointerBonus,
} from "@/lib/store-identity-match-policy";
import {
  canonicalizeStoreId,
  createMemoryStoreIdentityLookup,
  expandStoreIds,
  expandStoreIdsForRead,
  listAliases,
  resolveIdentity,
  scopeStoreIdsForPricing,
} from "@/lib/store-identity-resolvers";
import {
  isStoreIdentityAutoConfirmEnabled,
  isStoreIdentityExpandEnabled,
  isStoreIdentitySearchProvisionalEnabled,
  isStoreIdentitySnapMatchingEnabled,
  resolveStoreIdentityFeatureFlags,
} from "@/lib/store-identity-flags";

describe("store identity match policy (pinned starting thresholds)", () => {
  it("exposes pinned starting knobs (unvalidated until Slice 2)", () => {
    expect(STORE_IDENTITY_HARD_MILES).toBe(0.15);
    expect(STORE_IDENTITY_SOFT_MILES).toBe(0.05);
    expect(STORE_IDENTITY_CONFIRM_THRESHOLD).toBe(0.85);
    expect(STORE_IDENTITY_PROVISIONAL_THRESHOLD).toBe(0.7);
  });

  it("pins fixture distances: Kroger ~0.0001, Aldi 0, Food Lion ~0.2", () => {
    const distances = assertFixtureDistances();
    expect(distances.krogerMiles).toBeGreaterThan(0);
    expect(distances.krogerMiles).toBeLessThan(0.001);
    expect(distances.aldiMiles).toBe(0);
    expect(distances.foodLionMiles).toBeGreaterThan(0.2);
    expect(distances.foodLionMiles).toBeLessThan(0.25);
  });

  it("scores Kroger API+slug twin into confirm range", () => {
    const score = scoreStoreIdentityMatch(FIXTURE_KROGER_API, FIXTURE_KROGER_SLUG);
    expect(score.rejectedReason).toBeUndefined();
    expect(score.classification).toBe("confirmed");
    expect(score.confidence).toBeGreaterThanOrEqual(STORE_IDENTITY_CONFIRM_THRESHOLD);
  });

  it("scores Aldi+OSM into confirm range with pointer bonus doing work", () => {
    const withPointer = scoreStoreIdentityMatch(FIXTURE_ALDI_CATALOG, FIXTURE_ALDI_OSM);
    expect(scoreStoreIdentityPointerBonus(FIXTURE_ALDI_CATALOG, FIXTURE_ALDI_OSM)).toBe(
      1,
    );
    expect(withPointer.pointerScore).toBe(1);
    expect(withPointer.classification).toBe("confirmed");
    expect(withPointer.confidence).toBeGreaterThanOrEqual(
      STORE_IDENTITY_CONFIRM_THRESHOLD,
    );

    const withoutPointerCatalog = {
      ...FIXTURE_ALDI_CATALOG,
      sourceStoreId: "aldi-mechanicsville",
    };
    const withoutPointerOsm = {
      ...FIXTURE_ALDI_OSM,
      sourceStoreId: null,
    };
    const noPointer = scoreStoreIdentityMatch(
      withoutPointerCatalog,
      withoutPointerOsm,
    );
    expect(noPointer.pointerScore).toBe(0);
    expect(withPointer.confidence).toBeGreaterThan(noPointer.confidence);
  });

  it("does NOT link same-brand stores ~0.2 mi apart", () => {
    const score = scoreStoreIdentityMatch(
      FIXTURE_FOOD_LION_A,
      FIXTURE_FOOD_LION_B_NEARBY,
    );
    expect(score.miles).toBeGreaterThan(STORE_IDENTITY_HARD_MILES);
    expect(score.classification).toBe("none");
    expect(score.rejectedReason).toBe("beyond-hard-miles");
  });
});

describe("store identity feature flags", () => {
  it("defaults all flags OFF when env unset", () => {
    const flags = resolveStoreIdentityFeatureFlags({});
    expect(flags).toEqual({
      expandEnabled: false,
      autoConfirmEnabled: false,
      snapMatchingEnabled: false,
      searchProvisionalEnabled: false,
    });
    expect(isStoreIdentityExpandEnabled({})).toBe(false);
    expect(isStoreIdentityAutoConfirmEnabled({})).toBe(false);
    expect(isStoreIdentitySnapMatchingEnabled({})).toBe(false);
    expect(isStoreIdentitySearchProvisionalEnabled({})).toBe(false);
  });

  it("enables flags only when explicitly truthy", () => {
    const env = {
      YUM4LESS_STORE_IDENTITY_EXPAND: "1",
      YUM4LESS_STORE_IDENTITY_AUTO_CONFIRM: "true",
      YUM4LESS_STORE_IDENTITY_SNAP_MATCHING: "yes",
      YUM4LESS_STORE_IDENTITY_SEARCH_PROVISIONAL: "1",
    };
    expect(resolveStoreIdentityFeatureFlags(env)).toEqual({
      expandEnabled: true,
      autoConfirmEnabled: true,
      snapMatchingEnabled: true,
      searchProvisionalEnabled: true,
    });
  });
});

describe("store identity resolvers", () => {
  it("returns a virtual singleton for unlinked known stores", () => {
    const lookup = createMemoryStoreIdentityLookup({
      identities: [],
      aliases: [],
      knownStoreIds: ["aldi-mechanicsville"],
    });

    const resolved = resolveIdentity(lookup, { storeId: "aldi-mechanicsville" });
    expect(resolved?.isVirtualSingleton).toBe(true);
    expect(resolved?.canonicalStoreId).toBe("aldi-mechanicsville");
    expect(resolved?.memberStoreIds).toEqual(["aldi-mechanicsville"]);
    expect(canonicalizeStoreId(lookup, "aldi-mechanicsville")).toBe(
      "aldi-mechanicsville",
    );
  });

  it("returns null for unknown store ids when known-set is provided", () => {
    const lookup = createMemoryStoreIdentityLookup({
      identities: [],
      aliases: [],
      knownStoreIds: ["aldi-mechanicsville"],
    });
    expect(resolveIdentity(lookup, { storeId: "missing-store" })).toBeNull();
  });

  it("canonicalizes Kroger slug to API id and expands both members", () => {
    const lookup = createLinkedKrogerIdentityLookup();
    expect(canonicalizeStoreId(lookup, "kroger-mechanicsville")).toBe(
      "kroger-02900529",
    );
    expect(canonicalizeStoreId(lookup, "kroger-02900529")).toBe("kroger-02900529");

    const expanded = expandStoreIds(lookup, ["kroger-mechanicsville"]);
    expect(expanded.sort()).toEqual(
      ["kroger-02900529", "kroger-mechanicsville"].sort(),
    );

    const aliases = listAliases(lookup, "kroger-02900529");
    expect(aliases).toHaveLength(2);
  });

  it("expands Aldi catalog selection to include OSM member", () => {
    const lookup = createLinkedAldiOsmIdentityLookup();
    expect(expandStoreIds(lookup, ["aldi-mechanicsville"]).sort()).toEqual(
      ["aldi-mechanicsville", "osm-node-6531578976"].sort(),
    );
  });

  it("expandStoreIdsForRead is a no-op when master flag is OFF", () => {
    const lookup = createLinkedKrogerIdentityLookup();
    expect(
      expandStoreIdsForRead(lookup, ["kroger-mechanicsville"], {}),
    ).toEqual(["kroger-mechanicsville"]);
    expect(
      expandStoreIdsForRead(lookup, ["kroger-mechanicsville"], {
        YUM4LESS_STORE_IDENTITY_EXPAND: "1",
      }).sort(),
    ).toEqual(["kroger-02900529", "kroger-mechanicsville"].sort());
  });
});

describe("scopeStoreIdsForPricing expand anti-pattern guard", () => {
  it("fails if expand is bypassed (exact-id-only) when obs live on alias member", () => {
    const lookup = createLinkedKrogerIdentityLookup();
    const selectedIds = ["kroger-02900529"];
    const observationStoreIds = ["kroger-mechanicsville"];

    const exactIdOnly = (ids: string[]) => [...ids];
    const silentEmpty = scopeStoreIdsForPricing({
      selectedIds,
      observationStoreIds,
      expand: exactIdOnly,
    });
    expect(silentEmpty).toEqual([]);

    const withExpand = scopeStoreIdsForPricing({
      selectedIds,
      observationStoreIds,
      expand: (ids) => expandStoreIds(lookup, ids),
    });
    expect(withExpand).toEqual(["kroger-mechanicsville"]);
  });
});
