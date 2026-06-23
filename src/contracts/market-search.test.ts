import { describe, expect, it } from "vitest";
import { parseMarketSearchRequest } from "@/contracts/market-search";

describe("parseMarketSearchRequest", () => {
  it("accepts a valid ZIP + radius payload", () => {
    expect(parseMarketSearchRequest({ zipCode: "23111", radiusMiles: 5 })).toEqual({
      zipCode: "23111",
      radiusMiles: 5,
    });
  });

  it("accepts browser coordinates without a ZIP", () => {
    expect(
      parseMarketSearchRequest({
        zipCode: "",
        radiusMiles: 5,
        latitude: 37.6085,
        longitude: -77.3739,
      }),
    ).toEqual({
      zipCode: "",
      radiusMiles: 5,
      latitude: 37.6085,
      longitude: -77.3739,
    });
  });

  it.each([
    [{ zipCode: "23111" }, "missing radius"],
    [{ zipCode: "23111", radiusMiles: 0 }, "radius below min"],
    [{ zipCode: "23111", radiusMiles: 26 }, "radius above max"],
    [{ zipCode: "2311", radiusMiles: 5 }, "invalid ZIP"],
    [{ radiusMiles: 5 }, "missing location"],
    [null, "null body"],
  ])("rejects invalid payload (%s)", (body) => {
    expect(parseMarketSearchRequest(body)).toBeUndefined();
  });
});
