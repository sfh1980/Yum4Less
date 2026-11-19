import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OSM_GROCERY_FILE_DEFAULT,
  readOsmGroceryFile,
} from "@/lib/osm-grocery-file";

describe("OSM grocery file setting", () => {
  it("uses /osm/us-grocery.osm.pbf when the setting is missing or blank", () => {
    expect(readOsmGroceryFile({})).toBe(OSM_GROCERY_FILE_DEFAULT);
    expect(readOsmGroceryFile({ YUM4LESS_OSM_GROCERY_FILE: "  " })).toBe(
      OSM_GROCERY_FILE_DEFAULT,
    );
  });

  it("reads a path when one is set", () => {
    expect(
      readOsmGroceryFile({ YUM4LESS_OSM_GROCERY_FILE: "/osm/us-grocery.osm.pbf" }),
    ).toBe("/osm/us-grocery.osm.pbf");
  });

  it("is not scheduled by the nightly ingest", () => {
    const scheduled = readFileSync(
      join(process.cwd(), "scripts", "run-scheduled-weekly-ad-ingest.mjs"),
      "utf8",
    );
    const crontab = readFileSync(join(process.cwd(), "docker", "ingest", "crontab"), "utf8");
    const pipeline = readFileSync(
      join(process.cwd(), "src", "lib", "scheduled-ingest-pipeline.ts"),
      "utf8",
    );
    for (const source of [scheduled, crontab, pipeline]) {
      expect(source).not.toContain("YUM4LESS_OSM_GROCERY_FILE");
      expect(source).not.toContain("us-grocery.osm.pbf");
    }
  });
});
