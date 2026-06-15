import { describe, expect, it } from "vitest";
import {
  averageWitnessCoordinates,
  reconcileRankedStoreCoordinates,
  witnessesAgreeWithin,
} from "@/lib/store-location-reconciliation";

describe("store-location-reconciliation", () => {
  it("accepts a single provider witness when promoting bootstrap coordinates", () => {
    const result = reconcileRankedStoreCoordinates({
      current: {
        latitude: 37.6153,
        longitude: -77.3491,
        sourceName: "yum4less-internal-catalog",
      },
      witnesses: [
        {
          source: "kroger-official-api",
          latitude: 37.6154,
          longitude: -77.329,
        },
      ],
    });

    expect(result.action).toBe("update");
    expect(result.latitude).toBeCloseTo(37.6154, 4);
  });

  it("requires two agreeing witnesses before moving API-verified coordinates", () => {
    const current = {
      latitude: 37.6153,
      longitude: -77.3491,
      sourceName: "kroger-official-api",
    };

    const singleWitness = reconcileRankedStoreCoordinates({
      current,
      witnesses: [
        {
          source: "kroger-official-api",
          latitude: 37.62,
          longitude: -77.33,
        },
      ],
    });
    expect(singleWitness.action).toBe("keep");

    const disagreeing = reconcileRankedStoreCoordinates({
      current,
      witnesses: [
        {
          source: "kroger-official-api",
          latitude: 37.62,
          longitude: -77.33,
        },
        {
          source: "geocodio",
          latitude: 37.7,
          longitude: -77.4,
        },
      ],
    });
    expect(disagreeing.action).toBe("keep");

    const agreeing = reconcileRankedStoreCoordinates({
      current,
      witnesses: [
        {
          source: "kroger-official-api",
          latitude: 37.62,
          longitude: -77.33,
        },
        {
          source: "geocodio",
          latitude: 37.6201,
          longitude: -77.3301,
        },
      ],
      changeThresholdMeters: 10,
    });
    expect(agreeing.action).toBe("update");
    expect(agreeing.latitude).toBeCloseTo(37.62005, 4);
  });

  it("skips noisy updates when agreeing witnesses move less than the threshold", () => {
    const result = reconcileRankedStoreCoordinates({
      current: {
        latitude: 37.6153,
        longitude: -77.3491,
        sourceName: "kroger-official-api",
      },
      witnesses: [
        {
          source: "kroger-official-api",
          latitude: 37.61535,
          longitude: -77.34915,
        },
        {
          source: "geocodio",
          latitude: 37.61532,
          longitude: -77.34912,
        },
      ],
      changeThresholdMeters: 50,
    });

    expect(result.action).toBe("keep");
    expect(result.reason).toMatch(/below 50 m threshold/i);
  });

  it("averages agreeing witness coordinates", () => {
    const averaged = averageWitnessCoordinates([
      { source: "kroger-official-api", latitude: 37.6, longitude: -77.3 },
      { source: "geocodio", latitude: 37.8, longitude: -77.5 },
    ]);

    expect(averaged.latitude).toBeCloseTo(37.7, 5);
    expect(averaged.longitude).toBeCloseTo(-77.4, 5);
    expect(
      witnessesAgreeWithin(
        [
          { source: "kroger-official-api", latitude: 37.6, longitude: -77.3 },
          { source: "geocodio", latitude: 37.8, longitude: -77.5 },
        ],
        30_000,
      ),
    ).toBe(true);
  });
});
