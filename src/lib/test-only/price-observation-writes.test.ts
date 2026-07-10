import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProcessEnvKey } from "@/lib/test-only/process-env-test-helpers";
import { restoreTestNodeEnv, stubTestNodeEnv } from "@/lib/test-env";

const { getDbPool } = vi.hoisted(() => ({
  getDbPool: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDbPool,
}));

import { deleteAllPriceObservations } from "@/lib/test-only/price-observation-writes";

const originalNodeEnv = process.env.NODE_ENV;

describe("deleteAllPriceObservations (test-only)", () => {
  beforeEach(() => {
    getDbPool.mockReset();
    stubTestNodeEnv("test");
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      deleteProcessEnvKey("NODE_ENV");
    } else {
      stubTestNodeEnv(originalNodeEnv);
    }
  });

  it("deletes all price observations when NODE_ENV is test", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    getDbPool.mockReturnValue({ query });

    await deleteAllPriceObservations();

    expect(query).toHaveBeenCalledWith(`delete from price_observations`);
  });

  it("refuses to delete when NODE_ENV is not test", async () => {
    stubTestNodeEnv("development");

    await expect(deleteAllPriceObservations()).rejects.toThrow(
      /restricted to test environments/i,
    );
    expect(getDbPool).not.toHaveBeenCalled();
  });
});
