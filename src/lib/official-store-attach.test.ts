import { describe, expect, it } from "vitest";

import { chooseAttachedSourceStoreId } from "@/lib/official-store-attach";

describe("chooseAttachedSourceStoreId", () => {
  it("replaces a map pin id with the chain store number", () => {
    expect(
      chooseAttachedSourceStoreId({
        current: "osm-node-42",
        incoming: "02900515",
      }),
    ).toBe("02900515");
  });

  it("keeps a store number already written on a map row", () => {
    expect(
      chooseAttachedSourceStoreId({
        current: "02900515",
        incoming: "02900999",
      }),
    ).toBe("02900515");
  });

  it("fills an empty store number", () => {
    expect(
      chooseAttachedSourceStoreId({
        current: null,
        incoming: "1234",
      }),
    ).toBe("1234");
  });
});
