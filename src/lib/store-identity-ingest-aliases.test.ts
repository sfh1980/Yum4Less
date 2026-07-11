/**
 * Option A Slice 5c — unit tests for allowlist / key policy (no DB).
 */
import { describe, expect, it } from "vitest";
import {
  isAbsorbableSelfAliasSingleton,
  isAllowlistedAldiPointerCatalogSource,
  isOsmStorePointerTargetId,
  resolveSelfAliasKeys,
} from "@/lib/store-identity-ingest-aliases";

describe("store-identity ingest alias policy (Slice 5c)", () => {
  describe("isAllowlistedAldiPointerCatalogSource", () => {
    it("allowlists Aldi market-catalog and weekly-ad only", () => {
      expect(isAllowlistedAldiPointerCatalogSource("yum4less-market-catalog")).toBe(
        true,
      );
      expect(isAllowlistedAldiPointerCatalogSource("aldi-weekly-ad-scrape")).toBe(
        true,
      );
      expect(isAllowlistedAldiPointerCatalogSource("kroger-official-api")).toBe(
        false,
      );
      expect(isAllowlistedAldiPointerCatalogSource("openstreetmap-overpass")).toBe(
        false,
      );
      expect(isAllowlistedAldiPointerCatalogSource("publix-store-locator")).toBe(
        false,
      );
      expect(isAllowlistedAldiPointerCatalogSource(null)).toBe(false);
    });
  });

  describe("isOsmStorePointerTargetId", () => {
    it("accepts osm node/way ids and rejects unreliable pointers", () => {
      expect(isOsmStorePointerTargetId("osm-node-6531578976")).toBe(true);
      expect(isOsmStorePointerTargetId("osm-way-123")).toBe(true);
      expect(isOsmStorePointerTargetId("fixture-osm-node-999")).toBe(true);
      expect(isOsmStorePointerTargetId("kroger-02900529")).toBe(false);
      expect(isOsmStorePointerTargetId("aldi-mechanicsville")).toBe(false);
      expect(isOsmStorePointerTargetId("not-a-store")).toBe(false);
      expect(isOsmStorePointerTargetId("")).toBe(false);
      expect(isOsmStorePointerTargetId(null)).toBe(false);
    });
  });

  describe("resolveSelfAliasKeys", () => {
    it("uses provider id for Kroger official API and store id otherwise", () => {
      expect(
        resolveSelfAliasKeys({
          storeId: "kroger-02900529",
          sourceName: "kroger-official-api",
          sourceStoreId: "02900529",
        }),
      ).toEqual({
        sourceSystem: "kroger-official-api",
        externalId: "02900529",
      });

      expect(
        resolveSelfAliasKeys({
          storeId: "osm-node-1",
          sourceName: "openstreetmap-overpass",
          sourceStoreId: "osm-node-1",
        }),
      ).toEqual({
        sourceSystem: "openstreetmap-overpass",
        externalId: "osm-node-1",
      });

      expect(
        resolveSelfAliasKeys({
          storeId: "aldi-mechanicsville",
          sourceName: "aldi-weekly-ad-scrape",
          sourceStoreId: "osm-node-6531578976",
        }),
      ).toEqual({
        sourceSystem: "aldi-weekly-ad-scrape",
        externalId: "aldi-mechanicsville",
      });
    });
  });

  describe("isAbsorbableSelfAliasSingleton", () => {
    it("only absorbs single self-alias identity equal to store id", () => {
      expect(
        isAbsorbableSelfAliasSingleton({
          storeId: "osm-node-1",
          alias: { identity_id: "osm-node-1", match_method: "self" },
          memberCount: 1,
        }),
      ).toBe(true);

      expect(
        isAbsorbableSelfAliasSingleton({
          storeId: "osm-node-1",
          alias: { identity_id: "osm-node-1", match_method: "seeded" },
          memberCount: 1,
        }),
      ).toBe(false);

      expect(
        isAbsorbableSelfAliasSingleton({
          storeId: "osm-node-1",
          alias: { identity_id: "aldi-mechanicsville", match_method: "self" },
          memberCount: 1,
        }),
      ).toBe(false);

      expect(
        isAbsorbableSelfAliasSingleton({
          storeId: "osm-node-1",
          alias: { identity_id: "osm-node-1", match_method: "self" },
          memberCount: 2,
        }),
      ).toBe(false);
    });
  });
});
