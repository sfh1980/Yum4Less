/**
 * Option A Slice 4 — Aldi↔OSM identity expand (T1–T3).
 * Settings known-pair stays Kroger-only; T1 uses resolver/fixture lookup only.
 */
import { describe, expect, it } from "vitest";
import {
  createLinkedAldiOsmIdentityLookup,
  FIXTURE_ALDI_CATALOG,
  FIXTURE_ALDI_OSM,
  FIXTURE_FOOD_LION_A,
  FIXTURE_FOOD_LION_B_NEARBY,
} from "@/lib/fixtures/store-identity.fixtures";
import {
  STORE_IDENTITY_CONFIRM_THRESHOLD,
  STORE_IDENTITY_HARD_MILES,
  scoreStoreIdentityMatch,
} from "@/lib/store-identity-match-policy";
import {
  canonicalizeStoreId,
  expandStoreIds,
  expandStoreIdsForRead,
  listAliases,
} from "@/lib/store-identity-resolvers";
import { createSettingsKnownPairIdentityLookup } from "@/lib/store-identity-settings-lookup";

describe("Option A Slice 4 — Aldi↔OSM identity (T1–T3)", () => {
  it("T1: linked Aldi/OSM fixture expands and canonicalizes (flag ON)", () => {
    const lookup = createLinkedAldiOsmIdentityLookup();

    expect(canonicalizeStoreId(lookup, "aldi-mechanicsville")).toBe(
      "aldi-mechanicsville",
    );
    expect(canonicalizeStoreId(lookup, "osm-node-6531578976")).toBe(
      "aldi-mechanicsville",
    );

    expect(expandStoreIds(lookup, ["aldi-mechanicsville"]).sort()).toEqual(
      ["aldi-mechanicsville", "osm-node-6531578976"].sort(),
    );
    expect(expandStoreIds(lookup, ["osm-node-6531578976"]).sort()).toEqual(
      ["aldi-mechanicsville", "osm-node-6531578976"].sort(),
    );

    expect(
      expandStoreIdsForRead(lookup, ["aldi-mechanicsville"], {
        YUM4LESS_STORE_IDENTITY_EXPAND: "1",
      }).sort(),
    ).toEqual(["aldi-mechanicsville", "osm-node-6531578976"].sort());

    const aliases = listAliases(lookup, "aldi-mechanicsville");
    expect(aliases).toHaveLength(2);
    expect(aliases.map((row) => row.storeId).sort()).toEqual(
      ["aldi-mechanicsville", "osm-node-6531578976"].sort(),
    );
  });

  it("T2: flag OFF → expandStoreIdsForRead is exact-id (unchanged)", () => {
    const lookup = createLinkedAldiOsmIdentityLookup();
    expect(
      expandStoreIdsForRead(lookup, ["aldi-mechanicsville"], {}),
    ).toEqual(["aldi-mechanicsville"]);
    expect(
      expandStoreIdsForRead(lookup, ["osm-node-6531578976"], {}),
    ).toEqual(["osm-node-6531578976"]);
  });

  it("T3: Food Lion ~0.2 mi still does not false-link", () => {
    const score = scoreStoreIdentityMatch(
      FIXTURE_FOOD_LION_A,
      FIXTURE_FOOD_LION_B_NEARBY,
    );
    expect(score.miles).toBeGreaterThan(STORE_IDENTITY_HARD_MILES);
    expect(score.classification).toBe("none");
  });

  it("fixture Aldi↔OSM still scores 0.985 with real margin (not boundary)", () => {
    const score = scoreStoreIdentityMatch(FIXTURE_ALDI_CATALOG, FIXTURE_ALDI_OSM);
    expect(score.confidence).toBe(0.985);
    expect(score.pointerScore).toBe(1);
    expect(score.classification).toBe("confirmed");
    expect(score.confidence - STORE_IDENTITY_CONFIRM_THRESHOLD).toBeCloseTo(
      0.135,
      4,
    );
  });

  it("Settings known-pair remains Kroger-only (Aldi/OSM not remapped)", () => {
    const lookup = createSettingsKnownPairIdentityLookup();
    expect(canonicalizeStoreId(lookup, "aldi-mechanicsville")).toBe(
      "aldi-mechanicsville",
    );
    expect(canonicalizeStoreId(lookup, "osm-node-6531578976")).toBe(
      "osm-node-6531578976",
    );
    expect(expandStoreIds(lookup, ["aldi-mechanicsville"])).toEqual([
      "aldi-mechanicsville",
    ]);
  });
});
