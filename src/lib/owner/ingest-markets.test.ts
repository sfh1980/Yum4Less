import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZipLookupResult } from "@/lib/geocoding";

const readIngestMarket = vi.fn();
const upsertActiveMarket = vi.fn();
const resolveZipLocation = vi.fn();
const discoverMapContextStores = vi.fn();
const rememberIngestZipGeocode = vi.fn();

vi.mock("@/lib/active-markets", () => ({
  isMissingActiveMarketsSchema: (error: unknown) =>
    /active_markets/i.test(String(error instanceof Error ? error.message : error)),
  readIngestMarket: (...args: unknown[]) => readIngestMarket(...args),
  upsertActiveMarket: (...args: unknown[]) => upsertActiveMarket(...args),
}));

vi.mock("@/lib/geocoding", () => ({
  resolveZipLocation: (...args: unknown[]) => resolveZipLocation(...args),
}));

vi.mock("@/lib/map-context-discovery", () => ({
  discoverMapContextStores: (...args: unknown[]) => discoverMapContextStores(...args),
}));

vi.mock("@/lib/zip-geocode-cache", () => ({
  rememberIngestZipGeocode: (...args: unknown[]) => rememberIngestZipGeocode(...args),
}));

const {
  parseOwnerMarketZipInput,
  inspectOwnerIngestMarket,
  activateOwnerIngestMarket,
  NO_RANKED_V1_CHAIN_PREVIEW_NOTICE,
} = await import("@/lib/owner/ingest-markets");

function geocodeOk(zipCode = "23220"): ZipLookupResult {
  return {
    ok: true,
    providerConfigured: true,
    location: {
      zipCode,
      city: "Richmond",
      state: "VA",
      latitude: 37.5467,
      longitude: -77.4366,
      source: "geocodio",
    },
  };
}

describe("owner ingest markets", () => {
  afterEach(() => {
    readIngestMarket.mockReset();
    upsertActiveMarket.mockReset();
    resolveZipLocation.mockReset();
    discoverMapContextStores.mockReset();
    rememberIngestZipGeocode.mockReset();
  });

  it("rejects a body without a 5-digit ZIP", () => {
    expect(parseOwnerMarketZipInput({ zipCode: "2311" })).toEqual({
      ok: false,
      error: "Enter a 5-digit ZIP code.",
    });
  });

  it("accepts ZIP 23111 when the owner types it", () => {
    expect(parseOwnerMarketZipInput({ zipCode: "23111" })).toEqual({
      ok: true,
      zipCode: "23111",
    });
  });

  it("fails closed when geocode fails", async () => {
    resolveZipLocation.mockResolvedValue({
      ok: false,
      error: "GEOCODIO_API_KEY is required in production. Seed ZIP coordinates are disabled.",
      providerConfigured: false,
    });

    await expect(inspectOwnerIngestMarket("99999")).resolves.toEqual({
      ok: false,
      error: "GEOCODIO_API_KEY is required in production. Seed ZIP coordinates are disabled.",
    });
    expect(upsertActiveMarket).not.toHaveBeenCalled();
  });

  it("fails closed outside the continental US", async () => {
    resolveZipLocation.mockResolvedValue({
      ok: true,
      providerConfigured: true,
      location: {
        zipCode: "96813",
        city: "Honolulu",
        state: "HI",
        latitude: 21.3,
        longitude: -157.85,
        source: "geocodio",
      },
    });

    await expect(inspectOwnerIngestMarket("96813")).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/continental US/i),
    });
    expect(upsertActiveMarket).not.toHaveBeenCalled();
  });

  it("returns a short store list without inserting", async () => {
    resolveZipLocation.mockResolvedValue(geocodeOk());
    readIngestMarket.mockResolvedValue(null);
    discoverMapContextStores.mockResolvedValue({
      stores: [
        {
          name: "Kroger",
          city: "Richmond",
          state: "VA",
          kind: "grocery",
        },
      ],
      sources: [],
    });

    const inspected = await inspectOwnerIngestMarket("23220");
    expect(inspected).toMatchObject({
      ok: true,
      result: {
        zipCode: "23220",
        alreadyActive: false,
        stores: [{ name: "Kroger", city: "Richmond", state: "VA", kind: "grocery" }],
      },
    });
    expect(upsertActiveMarket).not.toHaveBeenCalled();
    if (inspected.ok) {
      expect(inspected.result.warnings).not.toContain(NO_RANKED_V1_CHAIN_PREVIEW_NOTICE);
    }
  });

  it("warns when the first look has no shopper-ranked v1 chain", async () => {
    resolveZipLocation.mockResolvedValue(geocodeOk());
    readIngestMarket.mockResolvedValue(null);
    discoverMapContextStores.mockResolvedValue({
      stores: [
        {
          name: "BJ's Wholesale Club",
          city: "Richmond",
          state: "VA",
          kind: "big-box",
        },
      ],
      sources: [],
    });

    const inspected = await inspectOwnerIngestMarket("23220");
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) {
      return;
    }
    expect(inspected.result.warnings).toContain(NO_RANKED_V1_CHAIN_PREVIEW_NOTICE);
    expect(upsertActiveMarket).not.toHaveBeenCalled();
  });

  it("does not fail when the first store look is empty", async () => {
    resolveZipLocation.mockResolvedValue(geocodeOk());
    readIngestMarket.mockResolvedValue(null);
    discoverMapContextStores.mockResolvedValue({ stores: [], sources: [] });

    const inspected = await inspectOwnerIngestMarket("23220");
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) {
      return;
    }
    expect(inspected.result.stores).toEqual([]);
    expect(inspected.result.warnings.join(" ")).toMatch(/No grocery pins/i);
    expect(inspected.result.warnings).toContain(NO_RANKED_V1_CHAIN_PREVIEW_NOTICE);
  });

  it("skips insert when the ZIP is already active", async () => {
    resolveZipLocation.mockResolvedValue(geocodeOk());
    readIngestMarket.mockResolvedValue({
      zipCode: "23220",
      status: "active",
      priority: 100,
      source: "ops",
      latitude: 37.5467,
      longitude: -77.4366,
      notes: null,
      updatedAt: "2026-08-27T12:00:00.000Z",
    });
    discoverMapContextStores.mockResolvedValue({ stores: [], sources: [] });

    const activated = await activateOwnerIngestMarket("23220");
    expect(activated).toMatchObject({
      ok: true,
      result: { alreadyActive: true, activatedNow: false },
    });
    expect(upsertActiveMarket).not.toHaveBeenCalled();
  });

  it("activates a new ZIP after a successful inspect", async () => {
    resolveZipLocation.mockResolvedValue(geocodeOk());
    readIngestMarket
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        zipCode: "23220",
        status: "active",
        priority: 100,
        source: "ops",
        latitude: 37.5467,
        longitude: -77.4366,
        notes: "Activated by /owner Markets",
        updatedAt: "2026-08-27T12:00:00.000Z",
      });
    discoverMapContextStores.mockResolvedValue({
      stores: [{ name: "Kroger", city: "Richmond", state: "VA", kind: "grocery" }],
      sources: [],
    });
    upsertActiveMarket.mockResolvedValue(undefined);
    rememberIngestZipGeocode.mockResolvedValue(undefined);

    const activated = await activateOwnerIngestMarket("23220");
    expect(activated).toMatchObject({
      ok: true,
      result: { alreadyActive: true, activatedNow: true, zipCode: "23220" },
    });
    expect(upsertActiveMarket).toHaveBeenCalledWith({
      zipCode: "23220",
      source: "ops",
      latitude: 37.5467,
      longitude: -77.4366,
      notes: "Activated by /owner Markets",
    });
    expect(rememberIngestZipGeocode).toHaveBeenCalled();
  });
});
