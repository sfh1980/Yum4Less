/**
 * Option A Slice 3 — Settings canonicalize + known-pair lookup (T1–T3).
 *
 * T1: stale alias localStorage round-trips to canonical without emptying selection
 * T2: flag OFF → exact-id (today's behavior)
 * T3: Kroger known-pair does not over-link other stores
 */

import { describe, expect, it } from "vitest";
import {
  SETTINGS_KNOWN_KROGER_ALIAS_ID,
  SETTINGS_KNOWN_KROGER_CANONICAL_ID,
  canonicalizeStoreIdsForSettings,
  createSettingsKnownPairIdentityLookup,
  filterSelectedStoreIdsAgainstSelectable,
  isSettingsStoreIdSelected,
} from "@/lib/store-identity-settings-lookup";
import { canonicalizeStoreId, expandStoreIds } from "@/lib/store-identity-resolvers";

const FLAG_ON = { YUM4LESS_STORE_IDENTITY_EXPAND: "1" } as const;
const FLAG_OFF = {} as const;

describe("Settings identity canonicalize (Slice 3)", () => {
  it("T1: stale alias selection remaps to canonical and survives selectable membership", () => {
    const remapped = canonicalizeStoreIdsForSettings(
      [SETTINGS_KNOWN_KROGER_ALIAS_ID],
      FLAG_ON,
    );
    expect(remapped).toEqual([SETTINGS_KNOWN_KROGER_CANONICAL_ID]);
    expect(remapped).not.toEqual([]);

    // Collapsed Settings list often exposes only the API survivor id.
    const selectable = new Set([SETTINGS_KNOWN_KROGER_CANONICAL_ID, "aldi-mechanicsville"]);
    const kept = filterSelectedStoreIdsAgainstSelectable(
      [SETTINGS_KNOWN_KROGER_ALIAS_ID],
      selectable,
      FLAG_ON,
    );
    expect(kept).toEqual([SETTINGS_KNOWN_KROGER_CANONICAL_ID]);
    expect(kept.length).toBeGreaterThan(0);
  });

  it("T2: flag OFF leaves Settings ids unchanged (exact-id today)", () => {
    expect(
      canonicalizeStoreIdsForSettings([SETTINGS_KNOWN_KROGER_ALIAS_ID], FLAG_OFF),
    ).toEqual([SETTINGS_KNOWN_KROGER_ALIAS_ID]);

    const selectable = new Set([SETTINGS_KNOWN_KROGER_CANONICAL_ID]);
    expect(
      filterSelectedStoreIdsAgainstSelectable(
        [SETTINGS_KNOWN_KROGER_ALIAS_ID],
        selectable,
        FLAG_OFF,
      ),
    ).toEqual([]);

    expect(
      isSettingsStoreIdSelected(
        [SETTINGS_KNOWN_KROGER_ALIAS_ID],
        SETTINGS_KNOWN_KROGER_CANONICAL_ID,
        FLAG_OFF,
      ),
    ).toBe(false);
  });

  it("T3: Kroger known-pair does not link Aldi or unrelated store ids", () => {
    const lookup = createSettingsKnownPairIdentityLookup();
    expect(canonicalizeStoreId(lookup, "aldi-mechanicsville")).toBe(
      "aldi-mechanicsville",
    );
    expect(expandStoreIds(lookup, ["aldi-mechanicsville"])).toEqual([
      "aldi-mechanicsville",
    ]);
    expect(canonicalizeStoreId(lookup, "food-lion-mechanicsville")).toBe(
      "food-lion-mechanicsville",
    );
    expect(
      canonicalizeStoreIdsForSettings(
        ["aldi-mechanicsville", SETTINGS_KNOWN_KROGER_ALIAS_ID],
        FLAG_ON,
      ),
    ).toEqual(["aldi-mechanicsville", SETTINGS_KNOWN_KROGER_CANONICAL_ID]);
  });

  it("UI1: alias and canonical count as the same Settings selection when flag ON", () => {
    expect(
      isSettingsStoreIdSelected(
        [SETTINGS_KNOWN_KROGER_ALIAS_ID],
        SETTINGS_KNOWN_KROGER_CANONICAL_ID,
        FLAG_ON,
      ),
    ).toBe(true);
    expect(
      isSettingsStoreIdSelected(
        [SETTINGS_KNOWN_KROGER_CANONICAL_ID],
        SETTINGS_KNOWN_KROGER_ALIAS_ID,
        FLAG_ON,
      ),
    ).toBe(true);
  });
});
