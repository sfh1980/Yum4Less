import { afterEach, describe, expect, it, vi } from "vitest";

const resolveZctaGeometry = vi.fn();

vi.mock("@/lib/geo/zcta-boundary", () => ({
  resolveZctaGeometry: (...args: unknown[]) => resolveZctaGeometry(...args),
}));

const { listOwnerMarketCoverageShades } = await import(
  "@/lib/owner/owner-market-coverage-shades"
);

const sampleGeometry = {
  type: "Polygon" as const,
  coordinates: [
    [
      [-77.47, 37.54],
      [-77.44, 37.54],
      [-77.44, 37.56],
      [-77.47, 37.56],
      [-77.47, 37.54],
    ],
  ],
};

describe("listOwnerMarketCoverageShades", () => {
  afterEach(() => {
    resolveZctaGeometry.mockReset();
  });

  it("returns Census outlines for active and paused ZIPs only", async () => {
    resolveZctaGeometry.mockImplementation(async (input: { zipCode: string }) => {
      if (input.zipCode === "23111") {
        return { ok: false, error: "missing" };
      }
      return { ok: true, source: "cache", geometry: sampleGeometry };
    });

    await expect(
      listOwnerMarketCoverageShades([
        { zipCode: "23220", status: "active" },
        { zipCode: "23223", status: "paused" },
        { zipCode: "23224", status: "retired" },
        { zipCode: "23111", status: "active" },
      ]),
    ).resolves.toEqual([
      { zipCode: "23220", status: "active", geometry: sampleGeometry },
      { zipCode: "23223", status: "paused", geometry: sampleGeometry },
    ]);
  });
});
