import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatRankedFreshnessLogLines,
  isFreshnessHeartbeatSkipped,
  notifyFreshnessWebhookIfConfigured,
  shouldFailRankedPriceFreshnessExit,
  type RankedFreshnessReport,
} from "@/lib/ingest/ingest-freshness-heartbeat";

const emptyReport: RankedFreshnessReport = {
  freshTotal: 0,
  totalRanked: 0,
  bySource: [],
};

const staleWithHistory: RankedFreshnessReport = {
  freshTotal: 0,
  totalRanked: 308,
  bySource: [
    {
      sourceName: "aldi-weekly-ad-scrape",
      freshCount: 0,
      totalCount: 39,
      newestAgeHours: 72,
    },
    {
      sourceName: "kroger-official-api",
      freshCount: 0,
      totalCount: 96,
      newestAgeHours: 48.5,
    },
  ],
};

const freshReport: RankedFreshnessReport = {
  freshTotal: 40,
  totalRanked: 120,
  bySource: [
    {
      sourceName: "aldi-weekly-ad-scrape",
      freshCount: 0,
      totalCount: 20,
      newestAgeHours: 30,
    },
    {
      sourceName: "kroger-official-api",
      freshCount: 40,
      totalCount: 100,
      newestAgeHours: 2.1,
    },
  ],
};

describe("shouldFailRankedPriceFreshnessExit", () => {
  it("fails when freshTotal is zero (empty DB)", () => {
    expect(shouldFailRankedPriceFreshnessExit(emptyReport)).toBe(true);
  });

  it("fails when rows exist but none are inside 24h", () => {
    expect(shouldFailRankedPriceFreshnessExit(staleWithHistory)).toBe(true);
  });

  it("passes when any ranked source has fresh rows (single-chain thin week OK)", () => {
    expect(shouldFailRankedPriceFreshnessExit(freshReport)).toBe(false);
  });
});

describe("formatRankedFreshnessLogLines", () => {
  it("emits STALE status and empty-db note", () => {
    const lines = formatRankedFreshnessLogLines(emptyReport);
    expect(lines[0]).toContain("[freshness] STALE");
    expect(lines[0]).toContain("0 fresh");
    expect(lines.some((line) => line.includes("no ranked in-stock"))).toBe(
      true,
    );
  });

  it("emits OK and per-source breakdown", () => {
    const lines = formatRankedFreshnessLogLines(freshReport);
    expect(lines[0]).toContain("[freshness] OK");
    expect(lines.some((line) => line.includes("kroger-official-api"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("aldi-weekly-ad-scrape"))).toBe(
      true,
    );
  });
});

describe("isFreshnessHeartbeatSkipped", () => {
  it("is off by default", () => {
    expect(isFreshnessHeartbeatSkipped({})).toBe(false);
  });

  it("honors emergency skip flag", () => {
    expect(
      isFreshnessHeartbeatSkipped({ YUM4LESS_SKIP_FRESHNESS_HEARTBEAT: "1" }),
    ).toBe(true);
  });
});

describe("notifyFreshnessWebhookIfConfigured", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call fetch when report is OK", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await notifyFreshnessWebhookIfConfigured(freshReport, {
      YUM4LESS_FRESHNESS_WEBHOOK_URL: "https://example.test/hook",
    });
    expect(result).toEqual({ attempted: false, ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch when URL unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await notifyFreshnessWebhookIfConfigured(staleWithHistory, {});
    expect(result).toEqual({ attempted: false, ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs JSON when stale and URL configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const result = await notifyFreshnessWebhookIfConfigured(staleWithHistory, {
      YUM4LESS_FRESHNESS_WEBHOOK_URL: "https://example.test/hook",
    });
    expect(result).toEqual({ attempted: true, ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.test/hook");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.status).toBe("STALE");
    expect(body.freshTotal).toBe(0);
  });
});
