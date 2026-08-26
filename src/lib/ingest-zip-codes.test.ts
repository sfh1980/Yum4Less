import { afterEach, describe, expect, it, vi } from "vitest";

const { listActiveMarketZipCodes } = vi.hoisted(() => ({
  listActiveMarketZipCodes: vi.fn(),
}));

vi.mock("@/lib/active-markets", () => ({
  listActiveMarketZipCodes,
}));

import {
  INGEST_ZIPS_REQUIRED_MESSAGE,
  IngestZipCodesRequiredError,
  mergeIngestZipSources,
  parseIngestZipCodesFromEnv,
  parseIngestZipOverlay,
  resolveRequiredProbeZipCode,
  resolveScheduledIngestZipCodes,
} from "@/lib/ingest-zip-codes";

describe("parseIngestZipCodesFromEnv", () => {
  it("parses comma-separated 5-digit ZIPs", () => {
    expect(parseIngestZipCodesFromEnv("30301, 23111")).toEqual([
      "30301",
      "23111",
    ]);
  });

  it("throws when the ingest list is present but has no valid ZIPs", () => {
    expect(() => parseIngestZipCodesFromEnv("bad, also-bad", "30301")).toThrow(
      IngestZipCodesRequiredError,
    );
  });

  it("uses YUM4LESS_PROVIDER_SYNC_ZIP only as an explicit alias when the list is blank", () => {
    expect(parseIngestZipCodesFromEnv("", "30301")).toEqual(["30301"]);
  });

  it("throws when no ingest ZIPs and no alias are set", () => {
    expect(() => parseIngestZipCodesFromEnv("", "")).toThrow(
      INGEST_ZIPS_REQUIRED_MESSAGE,
    );
  });
});

describe("mergeIngestZipSources", () => {
  it("prefers env overlay over database rows", () => {
    expect(
      mergeIngestZipSources({
        overlayZips: ["90210"],
        databaseZips: ["30301"],
      }),
    ).toEqual(["90210"]);
  });

  it("uses database rows when overlay is empty", () => {
    expect(
      mergeIngestZipSources({
        overlayZips: [],
        databaseZips: ["30301", "60601"],
      }),
    ).toEqual(["30301", "60601"]);
  });

  it("throws instead of defaulting to 23111 when both sources are empty", () => {
    expect(() =>
      mergeIngestZipSources({ overlayZips: [], databaseZips: [] }),
    ).toThrow(IngestZipCodesRequiredError);
  });
});

describe("resolveScheduledIngestZipCodes", () => {
  const original = {
    list: process.env.YUM4LESS_INGEST_ZIPS,
    alias: process.env.YUM4LESS_PROVIDER_SYNC_ZIP,
  };

  afterEach(() => {
    restoreEnv("YUM4LESS_INGEST_ZIPS", original.list);
    restoreEnv("YUM4LESS_PROVIDER_SYNC_ZIP", original.alias);
    listActiveMarketZipCodes.mockReset();
  });

  it("does not read active_markets when an env overlay is set", async () => {
    listActiveMarketZipCodes.mockResolvedValue(["30301"]);
    delete process.env.YUM4LESS_INGEST_ZIPS;
    delete process.env.YUM4LESS_PROVIDER_SYNC_ZIP;

    await expect(
      resolveScheduledIngestZipCodes({
        YUM4LESS_INGEST_ZIPS: "90210",
      }),
    ).resolves.toEqual(["90210"]);
    expect(listActiveMarketZipCodes).not.toHaveBeenCalled();
  });

  it("reads active_markets when env overlay is unset", async () => {
    listActiveMarketZipCodes.mockResolvedValue(["60601"]);
    delete process.env.YUM4LESS_INGEST_ZIPS;
    delete process.env.YUM4LESS_PROVIDER_SYNC_ZIP;

    await expect(resolveScheduledIngestZipCodes({})).resolves.toEqual(["60601"]);
  });

  it("throws when overlay and active_markets are both empty", async () => {
    listActiveMarketZipCodes.mockResolvedValue([]);
    delete process.env.YUM4LESS_INGEST_ZIPS;
    delete process.env.YUM4LESS_PROVIDER_SYNC_ZIP;

    await expect(resolveScheduledIngestZipCodes({})).rejects.toThrow(
      IngestZipCodesRequiredError,
    );
  });
});

describe("resolveRequiredProbeZipCode", () => {
  const original = {
    singular: process.env.YUM4LESS_INGEST_ZIP,
    list: process.env.YUM4LESS_INGEST_ZIPS,
    alias: process.env.YUM4LESS_PROVIDER_SYNC_ZIP,
  };

  afterEach(() => {
    restoreEnv("YUM4LESS_INGEST_ZIP", original.singular);
    restoreEnv("YUM4LESS_INGEST_ZIPS", original.list);
    restoreEnv("YUM4LESS_PROVIDER_SYNC_ZIP", original.alias);
  });

  it("prefers YUM4LESS_INGEST_ZIP when it is a valid ZIP", () => {
    expect(
      resolveRequiredProbeZipCode({
        YUM4LESS_INGEST_ZIP: "90210",
        YUM4LESS_INGEST_ZIPS: "23111",
      }),
    ).toBe("90210");
  });

  it("throws instead of defaulting to 23111", () => {
    expect(() =>
      resolveRequiredProbeZipCode({
        YUM4LESS_INGEST_ZIP: "",
        YUM4LESS_INGEST_ZIPS: "",
        YUM4LESS_PROVIDER_SYNC_ZIP: "",
      }),
    ).toThrow(IngestZipCodesRequiredError);
  });
});

describe("parseIngestZipOverlay", () => {
  it("returns empty when env is unset", () => {
    expect(parseIngestZipOverlay("", "")).toEqual([]);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
