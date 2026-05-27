import { afterEach, describe, expect, it, vi } from "vitest";

describe("isInternalDetailsUiEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false unless NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS=1", async () => {
    const { isInternalDetailsUiEnabled } = await import(
      "@/lib/show-internal-details-ui"
    );
    expect(isInternalDetailsUiEnabled()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS", "1");
    vi.resetModules();
    const { isInternalDetailsUiEnabled: enabled } = await import(
      "@/lib/show-internal-details-ui"
    );
    expect(enabled()).toBe(true);
  });
});
