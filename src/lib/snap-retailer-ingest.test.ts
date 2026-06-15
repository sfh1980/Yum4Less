import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseSnapRetailerCsv,
  parseSnapRetailerCsvWithReport,
} from "@/lib/snap-retailer-ingest";

describe("snap-retailer-ingest", () => {
  it("parses USDA historical FNS CSV headers and keeps active grocery rows only", () => {
    const csvPath = join(
      process.cwd(),
      "src/lib/fixtures/snap-retailers-usda-historical.sample.csv",
    );
    const { rows, report } = parseSnapRetailerCsvWithReport(
      readFileSync(csvPath, "utf8"),
      "2025-12-31",
    );

    expect(report.parsedRows).toBe(4);
    expect(report.skippedInactive).toBe(1);
    expect(report.skippedStoreType).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.id === "snap-fns-625183")).toBe(true);
    expect(rows.some((row) => row.retailerType === "SUPER STORE")).toBe(true);
  });

  it("parses fixture CSV and excludes convenience stores", () => {
    const csvPath = join(
      process.cwd(),
      "src/lib/fixtures/snap-retailers-23111.csv",
    );
    const rows = parseSnapRetailerCsv(readFileSync(csvPath, "utf8"), "2025-12-31");

    expect(rows).toHaveLength(3);
    expect(rows.some((row) => row.retailerName.includes("FOOD LION"))).toBe(true);
    expect(rows.some((row) => row.retailerName.includes("7-ELEVEN"))).toBe(false);
  });
});
