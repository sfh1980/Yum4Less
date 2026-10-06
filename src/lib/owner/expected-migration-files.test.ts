import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_MIGRATION_FILENAMES } from "@/lib/owner/expected-migration-files";

describe("expected migration files", () => {
  it("matches every db/init sql file", () => {
    const onDisk = readdirSync(join(process.cwd(), "db/init"))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect([...EXPECTED_MIGRATION_FILENAMES]).toEqual(onDisk);
  });
});
