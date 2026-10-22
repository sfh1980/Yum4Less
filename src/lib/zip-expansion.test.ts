import { describe, expect, it } from "vitest";
import { parseTouchingZctaCodes, readTouchingZctaResponse, usableTouchingZipList, ZCTA_NEIGHBOR_SPATIAL_REL } from "@/lib/geo/zcta-neighbors";
import {
  chainIdFromDisplayName,
  matchChainIdByName,
} from "@/lib/chain-registry-ensure";
import { matchSaleFeedChainByName } from "@/lib/chain-membership";

describe("surrounding ZIP codes", () => {
  it("reads Census ZIP codes and drops the ZIP itself", () => {
    expect(
      parseTouchingZctaCodes(
        {
          features: [
            { attributes: { ZCTA5: "23220" } },
            { attributes: { ZCTA5: "23221" } },
            { properties: { ZCTA5: "23227" } },
            { attributes: { ZCTA5: "nope" } },
          ],
        },
        "23220",
      ),
    ).toEqual(["23221", "23227"]);
  });

  it("asks Census for outlines that intersect, and drops the ZIP itself", () => {
    expect(ZCTA_NEIGHBOR_SPATIAL_REL).toBe("esriSpatialRelIntersects");
    expect(
      readTouchingZctaResponse(
        {
          features: [
            { attributes: { ZCTA5: "23220" } },
            { attributes: { ZCTA5: "23219" } },
          ],
        },
        "23220",
      ),
    ).toEqual({ ok: true, zipCodes: ["23219"] });
  });

  it("does not keep an empty neighbor list or a Census error", () => {
    expect(usableTouchingZipList([])).toBeNull();
    expect(usableTouchingZipList(null)).toBeNull();
    expect(usableTouchingZipList(["23219"])).toEqual(["23219"]);
    expect(readTouchingZctaResponse({ error: { code: 400 } }, "23220").ok).toBe(false);
    expect(readTouchingZctaResponse({}, "23220").ok).toBe(false);
  });
});

describe("map-only chain names", () => {
  it("reuses a chain the table already knows", () => {
    expect(chainIdFromDisplayName("Piggly Wiggly")).toBe("piggly-wiggly");
    expect(
      matchChainIdByName("H-E-B Plus", [
        {
          chainId: "heb",
          displayName: "H-E-B",
          nameMatchFragments: ["h-e-b"],
        },
      ]),
    ).toBe("heb");
    expect(
      matchChainIdByName("Piggly Wiggly", [
        {
          chainId: "kroger",
          displayName: "Kroger",
          nameMatchFragments: ["kroger"],
        },
      ]),
    ).toBeNull();
  });

  it("matches a saved flyer chain by name", () => {
    expect(
      matchSaleFeedChainByName("Piggly Wiggly #4", [
        {
          chainId: "piggly-wiggly",
          displayName: "Piggly Wiggly",
          nameMatchFragments: ["piggly wiggly"],
        },
      ])?.chainId,
    ).toBe("piggly-wiggly");
  });
});
