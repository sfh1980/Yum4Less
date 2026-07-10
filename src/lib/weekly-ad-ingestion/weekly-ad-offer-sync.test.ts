import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncWeeklyAdOffersToPriceObservations } from "@/lib/weekly-ad-ingestion/weekly-ad-offer-sync";
import type { WeeklyAdIngestionResult } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

const { insertPriceObservationIfChanged, touchStoreVerification } = vi.hoisted(() => ({
  insertPriceObservationIfChanged: vi.fn(),
  touchStoreVerification: vi.fn(),
}));

vi.mock("@/lib/price-observation-writes", () => ({
  insertPriceObservationIfChanged,
  touchStoreVerification,
  parseObservationTimestamp: (value: string) => new Date(value),
}));

describe("syncWeeklyAdOffersToPriceObservations persist failures (H5)", () => {
  beforeEach(() => {
    insertPriceObservationIfChanged.mockReset();
    touchStoreVerification.mockReset();
  });

  it("counts persist failures separately from skips and surfaces them in the summary", async () => {
    insertPriceObservationIfChanged
      .mockRejectedValueOnce(new Error("constraint violation"))
      .mockResolvedValueOnce("inserted");

    const result: WeeklyAdIngestionResult = {
      chain: "kroger",
      label: "Kroger",
      status: "cached",
      provenance: "weekly-ad-scrape",
      retrievalMode: "cached",
      configured: true,
      fallbackUsed: false,
      message: "Fixture ingest",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      termsNote: "Fixture weekly-ad terms.",
      offers: [
        {
          chain: "kroger",
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          productName: "Chicken thighs",
          price: 5.99,
          saleLabel: "Weekly special",
          sourceUrl: "https://example.test/ad",
          observedAt: "2026-06-19T12:00:00.000Z",
          confidenceScore: 0.9,
          matchConfidence: 0.9,
        },
        {
          chain: "kroger",
          storeId: "kroger-mechanicsville",
          ingredientId: "broccoli",
          productName: "Broccoli crowns",
          price: 2.49,
          saleLabel: "Weekly special",
          sourceUrl: "https://example.test/ad2",
          observedAt: "2026-06-19T12:00:00.000Z",
          confidenceScore: 0.9,
          matchConfidence: 0.9,
        },
      ],
    };

    const summary = await syncWeeklyAdOffersToPriceObservations({ result });

    expect(summary.failedCount).toBe(1);
    expect(summary.syncedCount).toBe(1);
    expect(summary.skippedCount).toBe(0);
    expect(summary.message).toContain("persist failure");
  });

  it("persists the highest-confidence offer per ingredient instead of last-write-wins (H9)", async () => {
    insertPriceObservationIfChanged.mockResolvedValue("inserted");

    const result: WeeklyAdIngestionResult = {
      chain: "kroger",
      label: "Kroger",
      status: "cached",
      provenance: "weekly-ad-scrape",
      retrievalMode: "cached",
      configured: true,
      fallbackUsed: false,
      message: "Fixture ingest",
      fetchedAt: "2026-06-19T12:00:00.000Z",
      termsNote: "Fixture weekly-ad terms.",
      offers: [
        {
          chain: "kroger",
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          productName: "Weak chicken match",
          price: 4.99,
          saleLabel: "Weekly special",
          sourceUrl: "https://example.test/ad-weak",
          observedAt: "2026-06-19T12:00:00.000Z",
          confidenceScore: 0.56,
          matchConfidence: 0.56,
        },
        {
          chain: "kroger",
          storeId: "kroger-mechanicsville",
          ingredientId: "chicken-thighs",
          productName: "Strong chicken match",
          price: 6.49,
          saleLabel: "Weekly special",
          sourceUrl: "https://example.test/ad-strong",
          observedAt: "2026-06-19T12:00:00.000Z",
          confidenceScore: 0.82,
          matchConfidence: 0.82,
        },
      ],
    };

    await syncWeeklyAdOffersToPriceObservations({ result });

    expect(insertPriceObservationIfChanged).toHaveBeenCalledTimes(1);
    expect(insertPriceObservationIfChanged.mock.calls[0]?.[0]).toMatchObject({
      ingredientId: "chicken-thighs",
      price: 6.49,
      sourceRecordId: expect.stringContaining("Strong chicken match"),
    });
  });
});
