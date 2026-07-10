import { describe, expect, it } from "vitest";
import {
  formatLiveIngestEnvError,
  validateLiveIngestEnv,
} from "@/lib/live-ingest-env";
import { buildTestProcessEnv } from "@/lib/test-only/process-env-test-helpers";

describe("live-ingest-env", () => {
  it("passes when GEOCODIO and Kroger keys are set", () => {
    expect(
      validateLiveIngestEnv(
        buildTestProcessEnv({
          GEOCODIO_API_KEY: "geo-key",
          KROGER_CLIENT_ID: "client",
          KROGER_CLIENT_SECRET: "secret",
        }),
      ).ok,
    ).toBe(true);
  });

  it("lists missing keys for live scheduled ingest", () => {
    const validation = validateLiveIngestEnv(
      buildTestProcessEnv({
        KROGER_CLIENT_ID: "client",
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.missing).toContain("GEOCODIO_API_KEY");
    expect(validation.missing).toContain("KROGER_CLIENT_SECRET");
    expect(formatLiveIngestEnvError(validation)).toContain("fixture");
  });
});
