import { describe, expect, it } from "vitest";
import {
  allowsSeedZipGeocodingFallback,
  isCiRuntime,
  isProductionRuntime,
  isTestRuntime,
} from "@/lib/runtime-environment";

describe("runtime-environment", () => {
  it("treats production as strict unless CI or test runners are active", () => {
    expect(
      allowsSeedZipGeocodingFallback({
        NODE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      allowsSeedZipGeocodingFallback({
        NODE_ENV: "production",
        CI: "true",
      }),
    ).toBe(true);
    expect(
      allowsSeedZipGeocodingFallback({
        NODE_ENV: "test",
      }),
    ).toBe(true);
    expect(
      allowsSeedZipGeocodingFallback({
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("detects CI and production runtimes", () => {
    expect(isProductionRuntime({ NODE_ENV: "production" })).toBe(true);
    expect(isCiRuntime({ CI: "true" })).toBe(true);
    expect(isCiRuntime({ CI: "1" })).toBe(true);
    expect(isTestRuntime({ NODE_ENV: "test" })).toBe(true);
  });
});
