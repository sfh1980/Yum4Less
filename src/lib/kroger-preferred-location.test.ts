import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import {
  filterKrogerLocationCandidates,
  pickNearestKrogerLocationId,
  resolveKrogerLocationIdFromEnv,
  resolvePreferredKrogerLocationIdForZip,
} from "@/lib/kroger-preferred-location";

const zip23111Location: ResolvedSearchLocation = {
  zipCode: "23111",
  city: "Mechanicsville",
  state: "VA",
  latitude: 37.6085,
  longitude: -77.3321,
  source: "seed",
};

function mockPool(rows: Array<{
  name: string;
  source_store_id: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
}>) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  } as unknown as Pool;
}

describe("filterKrogerLocationCandidates", () => {
  it("accepts Kroger-family rows with numeric location ids regardless of source_name", () => {
    const candidates = filterKrogerLocationCandidates([
      {
        name: "Kroger",
        source_store_id: "02900529",
        latitude: 37.6153,
        longitude: -77.3491,
      },
      {
        name: "Harris Teeter",
        source_store_id: "01111111",
        latitude: 37.58,
        longitude: -77.5,
      },
      {
        name: "Publix",
        source_store_id: "09999999",
        latitude: 37.58,
        longitude: -77.5,
      },
      {
        name: "Kroger",
        source_store_id: "kroger-mechanicsville",
        latitude: 37.6153,
        longitude: -77.3491,
      },
    ]);

    expect(candidates.map((row) => row.sourceStoreId)).toEqual(["02900529", "01111111"]);
  });
});

describe("pickNearestKrogerLocationId", () => {
  it("picks the nearest Kroger-family candidate by haversine distance", () => {
    const nearest = pickNearestKrogerLocationId(
      [
        {
          name: "Kroger",
          sourceStoreId: "02900529",
          latitude: 37.6153,
          longitude: -77.3491,
        },
        {
          name: "Harris Teeter",
          sourceStoreId: "01111111",
          latitude: 37.7,
          longitude: -77.1,
        },
      ],
      zip23111Location,
    );

    expect(nearest).toBe("02900529");
  });
});

describe("resolveKrogerLocationIdFromEnv", () => {
  const original = process.env.KROGER_LOCATION_ID;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.KROGER_LOCATION_ID;
    } else {
      process.env.KROGER_LOCATION_ID = original;
    }
  });

  it("returns a valid env location id", () => {
    process.env.KROGER_LOCATION_ID = " 02900529 ";
    expect(resolveKrogerLocationIdFromEnv()).toBe("02900529");
  });

  it("returns undefined for missing or invalid env values", () => {
    delete process.env.KROGER_LOCATION_ID;
    expect(resolveKrogerLocationIdFromEnv()).toBeUndefined();

    process.env.KROGER_LOCATION_ID = "kroger-mechanicsville";
    expect(resolveKrogerLocationIdFromEnv()).toBeUndefined();
  });
});

describe("resolvePreferredKrogerLocationIdForZip", () => {
  const original = process.env.KROGER_LOCATION_ID;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.KROGER_LOCATION_ID;
    } else {
      process.env.KROGER_LOCATION_ID = original;
    }
  });

  it("uses nearest distance selection when candidates have coordinates", async () => {
    delete process.env.KROGER_LOCATION_ID;
    process.env.KROGER_LOCATION_ID = "09999999";

    const pool = mockPool([
      {
        name: "Kroger",
        source_store_id: "02900529",
        latitude: 37.6153,
        longitude: -77.3491,
      },
      {
        name: "Harris Teeter",
        source_store_id: "01111111",
        latitude: 37.7,
        longitude: -77.1,
      },
      {
        name: "OSM Kroger",
        source_store_id: "02222222",
        latitude: 37.75,
        longitude: -77.05,
      },
    ]);

    const locationId = await resolvePreferredKrogerLocationIdForZip({
      location: zip23111Location,
      pool,
    });

    expect(locationId).toBe("02900529");
  });

  it("falls back to env when no qualifying rows exist", async () => {
    process.env.KROGER_LOCATION_ID = "02900529";

    const pool = mockPool([
      {
        name: "Publix",
        source_store_id: "09999999",
        latitude: 37.58,
        longitude: -77.5,
      },
    ]);

    const locationId = await resolvePreferredKrogerLocationIdForZip({
      location: zip23111Location,
      pool,
    });

    expect(locationId).toBe("02900529");
  });

  it("falls back to env when qualifying rows lack coordinates", async () => {
    process.env.KROGER_LOCATION_ID = "02900529";

    const pool = mockPool([
      {
        name: "Kroger",
        source_store_id: "02900529",
        latitude: null,
        longitude: null,
      },
      {
        name: "Harris Teeter",
        source_store_id: "01111111",
        latitude: "not-a-number",
        longitude: -77.5,
      },
    ]);

    const locationId = await resolvePreferredKrogerLocationIdForZip({
      location: zip23111Location,
      pool,
    });

    expect(locationId).toBe("02900529");
  });

  it("returns undefined when distance selection and env fallback both fail", async () => {
    delete process.env.KROGER_LOCATION_ID;

    const pool = mockPool([
      {
        name: "Kroger",
        source_store_id: "02900529",
        latitude: null,
        longitude: null,
      },
    ]);

    const locationId = await resolvePreferredKrogerLocationIdForZip({
      location: zip23111Location,
      pool,
    });

    expect(locationId).toBeUndefined();
  });

  it("returns undefined when location is missing and env is invalid", async () => {
    process.env.KROGER_LOCATION_ID = "invalid-slug";

    const pool = mockPool([
      {
        name: "Kroger",
        source_store_id: "02900529",
        latitude: 37.6153,
        longitude: -77.3491,
      },
    ]);

    const locationId = await resolvePreferredKrogerLocationIdForZip({
      pool,
    });

    expect(locationId).toBeUndefined();
  });

  it("uses env fallback when location is missing even if catalog rows have coordinates", async () => {
    process.env.KROGER_LOCATION_ID = "02900529";

    const pool = mockPool([
      {
        name: "Kroger",
        source_store_id: "01111111",
        latitude: 37.6153,
        longitude: -77.3491,
      },
    ]);

    const locationId = await resolvePreferredKrogerLocationIdForZip({
      pool,
    });

    expect(locationId).toBe("02900529");
  });
});
