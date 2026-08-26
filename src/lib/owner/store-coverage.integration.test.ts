import { afterEach, describe, expect, it } from "vitest";
import { getDbPool, resetDbPoolForTests } from "@/lib/db";
import { listChainRegistry, listStoreCoverage } from "@/lib/owner/store-coverage-repository";

describe("chain_registry and store_coverage (integration)", () => {
  afterEach(async () => {
    await resetDbPoolForTests();
  });

  it("seeds tracked banners and exposes coverage over stores", async () => {
    const pool = getDbPool();
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name in ('chain_registry', 'store_coverage')
       order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "chain_registry",
      "store_coverage",
    ]);

    const registry = await listChainRegistry();
    expect(registry.map((row) => row.chainId)).toEqual(
      expect.arrayContaining([
        "kroger",
        "aldi",
        "publix",
        "food-lion",
        "walmart",
        "target",
        "whole-foods",
      ]),
    );
    expect(registry.find((row) => row.chainId === "kroger")?.shopperRanked).toBe(true);
    expect(registry.find((row) => row.chainId === "walmart")?.promotionBlocked).toBe(true);
    expect(registry.find((row) => row.chainId === "target")?.rolloutStage).toBe("upcoming");

    const coverage = await listStoreCoverage({
      limit: 10,
      offset: 0,
    });
    expect(coverage.freshnessHours).toBe(24);
    expect(coverage.total).toBeGreaterThanOrEqual(0);
    expect(coverage.summaries.find((row) => row.chainId === "kroger")).toMatchObject({
      chainLabel: "Kroger",
      rolloutStage: "ranked",
    });
    expect(coverage.summaries.find((row) => row.chainId === "walmart")).toMatchObject({
      chainLabel: "Walmart",
      rolloutStage: "map_context",
    });
  });
});
