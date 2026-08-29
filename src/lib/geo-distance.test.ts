import { describe, expect, it } from "vitest";
import { boundingBoxForRadiusMiles, getDistanceMiles } from "@/lib/geo-distance";

describe("geo-distance", () => {
  it("returns a box that contains points inside the radius", () => {
    const box = boundingBoxForRadiusMiles(37.6085, -77.3739, 5);

    expect(box.minLatitude).toBeLessThan(37.6085);
    expect(box.maxLatitude).toBeGreaterThan(37.6085);
    expect(box.minLongitude).toBeLessThan(-77.3739);
    expect(box.maxLongitude).toBeGreaterThan(-77.3739);

    expect(
      getDistanceMiles(37.6085, -77.3739, box.maxLatitude, -77.3739),
    ).toBeGreaterThan(4.9);
  });
});
