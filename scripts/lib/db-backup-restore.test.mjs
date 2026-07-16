import { describe, expect, it } from "vitest";
import {
  PROTECTED_RESTORE_DATABASES,
  buildBackupFilename,
  assertSnapshotsMatch,
} from "./db-backup-restore.mjs";

describe("db-backup-restore helpers", () => {
  it("builds a timestamped dump filename for a safe database id", () => {
    const name = buildBackupFilename(
      "yum4less_dev",
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(name).toBe("yum4less_dev_2026-07-15T12-00-00-000Z.sql");
  });

  it("rejects unsafe database identifiers in filenames", () => {
    expect(() => buildBackupFilename("yum4less-dev;drop")).toThrow(/Unsafe/);
  });

  it("protects yum4less_dev from casual restore", () => {
    expect(PROTECTED_RESTORE_DATABASES.has("yum4less_dev")).toBe(true);
    expect(PROTECTED_RESTORE_DATABASES.has("yum4less_backup_drill")).toBe(false);
  });

  it("asserts integrity snapshots match", () => {
    const snap = { stores: 10, priceObservations: 100, schemaMigrations: 20 };
    expect(() => assertSnapshotsMatch(snap, { ...snap })).not.toThrow();
    expect(() =>
      assertSnapshotsMatch(snap, { ...snap, stores: 9 }, "test"),
    ).toThrow(/stores/);
  });
});
