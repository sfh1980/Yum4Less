import { describe, expect, it, vi } from "vitest";
import {
  checkCoordinateSanity,
  checkCoordinateSanityBatch,
  normalizeAddressForGeocodeQuery,
  type StoreForSanityCheck,
} from "@/lib/geo/coordinate-sanity-check";

function buildStore(overrides: Partial<StoreForSanityCheck> = {}): StoreForSanityCheck {
  return {
    id: "food-lion-mechanicsville",
    address: "7350 Mechanicsville Tpke",
    city: "Mechanicsville",
    state: "VA",
    zip: "23111",
    geocodeCity: "Mechanicsville",
    geocodeState: "VA",
    geocodeZip: "23111",
    lat: 37.6098,
    lon: -77.3562,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("coordinate sanity check", () => {
  it("normalizes Market Place to Marketplace for geocode queries", () => {
    expect(normalizeAddressForGeocodeQuery("7300 Market Place Dr")).toBe(
      "7300 Marketplace Dr",
    );
  });

  it("passes when the geocoded point is within the default threshold", async () => {
    const result = await checkCoordinateSanity(buildStore(), {
      fetchImpl: vi.fn(async () =>
        jsonResponse([{ lat: "37.6099", lon: "-77.3561" }]),
      ) as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(result.flagReasons).toEqual([]);
    expect(result.deltaMiles).not.toBeNull();
    expect(result.suggestedCoords).toEqual({
      lat: 37.6099,
      lon: -77.3561,
    });
  });

  it("flags a coordinate delta when the geocoded point is too far away", async () => {
    const result = await checkCoordinateSanity(buildStore(), {
      fetchImpl: vi.fn(async () =>
        jsonResponse([{ lat: "37.644", lon: "-77.289" }]),
      ) as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(result.flagReasons).toEqual(["coordinate_delta"]);
    expect(result.deltaMiles).toBeGreaterThan(0.25);
  });

  it("returns missing_address without calling Nominatim when address is empty", async () => {
    const fetchImpl = vi.fn();

    const result = await checkCoordinateSanity(buildStore({ address: "   " }), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(result.flagReasons).toEqual(["missing_address"]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports unknown city/state independently from geocode success", async () => {
    const result = await checkCoordinateSanity(
      buildStore({
        city: "Unknown",
        state: "Unknown",
        geocodeCity: "Mechanicsville",
        geocodeState: "VA",
      }),
      {
        fetchImpl: vi.fn(async () =>
          jsonResponse([{ lat: "37.6099", lon: "-77.3561" }]),
        ) as typeof fetch,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.flagReasons).toEqual(["unknown_city_state"]);
  });

  it("keeps coordinate deltas visible alongside unknown city/state", async () => {
    const result = await checkCoordinateSanity(
      buildStore({
        city: "Unknown",
        state: "Unknown",
        geocodeCity: "Richmond",
        geocodeState: "VA",
        geocodeZip: "23223",
      }),
      {
        fetchImpl: vi.fn(async () =>
          jsonResponse([{ lat: "37.5560", lon: "-77.4102" }]),
        ) as typeof fetch,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.flagReasons).toEqual([
      "unknown_city_state",
      "coordinate_delta",
    ]);
  });

  it("retries once on a transient upstream failure before succeeding", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([], 503))
      .mockResolvedValueOnce(jsonResponse([{ lat: "37.6098", lon: "-77.3562" }]));

    const result = await checkCoordinateSanity(buildStore(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
      retryBackoffMs: 55,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(55);
  });

  it("normalizes Market Place street spelling for Nominatim queries", async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
      expect(url.searchParams.get("q")).toBe(
        "7300 Marketplace Dr, Quinton, VA, 23141",
      );
      return jsonResponse([{ lat: "37.5088", lon: "-77.1858" }]);
    });

    const result = await checkCoordinateSanity(
      buildStore({
        id: "osm-way-247599436",
        address: "7300 Market Place Dr",
        city: "Quinton",
        state: "VA",
        zip: "23141",
        geocodeCity: "Quinton",
        geocodeState: "VA",
        geocodeZip: "23141",
        lat: 37.5088,
        lon: -77.1858,
      }),
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("runs the batch sequentially with a sleep between requests", async () => {
    const events: string[] = [];
    const sleep = vi.fn(async (ms: number) => {
      events.push(`sleep:${ms}`);
    });
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url =
        input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
      events.push(`fetch:${url.searchParams.get("q")}`);
      return jsonResponse([{ lat: "37.6098", lon: "-77.3562" }]);
    });

    const results = await checkCoordinateSanityBatch(
      [
        buildStore({ id: "store-a", address: "1 Main St" }),
        buildStore({ id: "store-b", address: "2 Main St" }),
      ],
      {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep,
        requestDelayMs: 7,
      },
    );

    expect([...results.keys()]).toEqual(["store-a", "store-b"]);
    expect(events).toEqual([
      "fetch:1 Main St, Mechanicsville, VA, 23111",
      "sleep:7",
      "fetch:2 Main St, Mechanicsville, VA, 23111",
    ]);
  });
});
