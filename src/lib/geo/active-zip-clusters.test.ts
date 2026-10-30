import { describe, expect, it } from "vitest";
import {
  clusterActiveZipCodes,
  flyerZipClusterMemberSet,
  storeSharesFlyerZipCluster,
  weeklyAdTouchingZipFailureMessage,
} from "@/lib/geo/active-zip-clusters";

/**
 * Stand-in graph. These ZIP codes are fixture inputs, not a live roster.
 * 23005 is the fetch ZIP. 23111, 23220, and 23224 connect through saved
 * neighbor lists. 28269 does not.
 */
function connectedFixture() {
  return {
    flyerZipCode: "23005",
    activeZipCodes: ["23005", "23111", "23220", "23224", "28269"],
    touchingByActiveZip: new Map<string, readonly string[]>([
      ["23005", ["23111"]],
      ["23111", ["23220"]],
      ["23220", ["23224"]],
      ["23224", []],
      ["28269", []],
    ]),
  };
}

/**
 * Saved neighbor lists for the 24 active ZIPs, pasted 2026-10-29.
 * Neighbors that are not themselves active do not join a group.
 */
const ACTIVE_ZIPS_2026_10_29 = [
  "23005",
  "23009",
  "23059",
  "23060",
  "23075",
  "23086",
  "23089",
  "23111",
  "23219",
  "23220",
  "23221",
  "23222",
  "23223",
  "23224",
  "23225",
  "23226",
  "23227",
  "23228",
  "23229",
  "23230",
  "23233",
  "23235",
  "23298",
  "28269",
];

const SAVED_NEIGHBOR_LISTS_2026_10_29 = new Map<string, readonly string[]>([
  ["23005", []],
  ["23009", []],
  ["23089", []],
  ["23059", ["23005", "23060", "23116", "23146", "23192", "23227", "23233"]],
  ["23060", ["23059", "23227", "23228", "23233", "23294"]],
  ["23075", ["23111", "23150", "23223", "23231"]],
  ["23086", ["23009", "23089", "23106", "23111", "23124", "23148", "23177", "23181"]],
  ["23111", ["23075", "23086", "23106", "23116", "23124", "23141", "23150", "23222", "23223"]],
  ["23219", ["23225"]],
  ["23220", ["23224"]],
  ["23221", ["23220", "23225", "23226", "23230"]],
  ["23222", ["23111", "23116", "23219", "23220", "23223", "23227"]],
  ["23223", ["23075", "23111", "23219", "23222", "23224", "23231"]],
  ["23224", ["23220"]],
  ["23225", ["23219", "23220", "23221", "23224", "23226", "23235"]],
  ["23226", ["23173", "23221", "23225", "23229", "23230", "23235", "23294"]],
  ["23227", ["23059", "23060", "23116", "23220", "23222", "23228", "23230"]],
  ["23228", ["23060", "23227", "23230", "23294"]],
  ["23229", ["23173", "23226", "23233", "23235", "23238", "23294"]],
  ["23230", ["23220", "23221", "23226", "23227", "23228", "23294"]],
  ["23233", ["23059", "23060", "23103", "23146", "23229", "23238", "23294"]],
  ["23235", ["23113", "23224", "23225", "23226", "23229", "23236", "23238", "23832"]],
  ["23298", ["23219"]],
  ["28269", ["28027", "28078", "28206", "28213", "28216", "28262"]],
]);

describe("active ZIP clusters", () => {
  it("joins ZIPs when either side lists the other and leaves a ZIP with no list alone", () => {
    const groups = clusterActiveZipCodes(connectedFixture());

    expect(groups).toEqual([
      ["23005", "23111", "23220", "23224"],
      ["28269"],
    ]);
  });

  it("connects a ZIP whose own list is empty when another active ZIP lists it", () => {
    const members = flyerZipClusterMemberSet({
      flyerZipCode: "23005",
      activeZipCodes: ["23005", "23111"],
      touchingByActiveZip: new Map([
        ["23005", []],
        ["23111", ["23005"]],
      ]),
    });

    expect([...members].sort()).toEqual(["23005", "23111"]);
  });

  it("keeps every store admitted inside the fetch cluster and drops the other cluster", () => {
    const members = flyerZipClusterMemberSet(connectedFixture());
    const admitting = new Map<string, string[]>();
    for (let index = 1; index <= 40; index += 1) {
      const zipCodes = ["23005", "23111", "23220", "23224"];
      admitting.set(`priced-store-${String(index).padStart(2, "0")}`, [
        zipCodes[(index - 1) % zipCodes.length]!,
      ]);
    }
    admitting.set("priced-store-40", ["23005", "28269"]);
    admitting.set("other-cluster-store", ["28269"]);

    const kept = [...admitting.keys()].filter((storeId) =>
      storeSharesFlyerZipCluster({
        admittingZipCodes: admitting.get(storeId) ?? [],
        flyerCluster: members,
      }),
    );

    expect(kept).toHaveLength(40);
    expect(kept).not.toContain("other-cluster-store");
    expect(kept).toContain("priced-store-40");
  });

  it("splits the 24 saved neighbor lists into Richmond and 28269", () => {
    const groups = clusterActiveZipCodes({
      activeZipCodes: ACTIVE_ZIPS_2026_10_29,
      touchingByActiveZip: SAVED_NEIGHBOR_LISTS_2026_10_29,
    });

    expect(groups).toHaveLength(2);
    expect(groups[1]).toEqual(["28269"]);
    expect(groups[0]).toHaveLength(23);
    expect(groups[0]).toEqual(
      ACTIVE_ZIPS_2026_10_29.filter((zipCode) => zipCode !== "28269").sort(),
    );
  });

  it("stops the weekly-ad step with a sentence when the neighbor-list read throws", () => {
    expect(weeklyAdTouchingZipFailureMessage("connection refused")).toBe(
      "Touching-ZIP lists could not be read (connection refused). Weekly-ad wrote nothing.",
    );
  });

  it("does not price a store that no admitting ZIP places in the fetch cluster", () => {
    const members = flyerZipClusterMemberSet(connectedFixture());

    expect(
      storeSharesFlyerZipCluster({
        admittingZipCodes: [],
        flyerCluster: members,
      }),
    ).toBe(false);
  });
});
