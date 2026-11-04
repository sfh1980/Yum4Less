import { describe, expect, it } from "vitest";
import {
  readWeeklyAdOnlyChain,
  storesForWeeklyAdOnlyChain,
} from "@/lib/weekly-ad-ingestion/weekly-ad-only-chain";

describe("weekly-ad --chain", () => {
  it("accepts any weekly-ad chain id", () => {
    expect(readWeeklyAdOnlyChain(["--chain", "whole-foods"])).toBe("whole-foods");
    expect(readWeeklyAdOnlyChain(["--chain=publix"])).toBe("publix");
    expect(readWeeklyAdOnlyChain(["node", "ingest"])).toBeUndefined();
  });

  it("rejects a chain that is not on the weekly-ad list", () => {
    expect(() => readWeeklyAdOnlyChain(["--chain", "bjs"])).toThrow(/whole-foods/);
    expect(() => readWeeklyAdOnlyChain(["--chain"])).toThrow(/--chain/);
  });

  it("keeps only the named chain's stores", () => {
    const stores = [
      { id: "a", chain: "aldi" },
      { id: "w", chain: "whole-foods" },
    ];
    expect(storesForWeeklyAdOnlyChain(stores, "whole-foods").map((store) => store.id)).toEqual([
      "w",
    ]);
    expect(storesForWeeklyAdOnlyChain(stores, undefined)).toHaveLength(2);
  });
});
