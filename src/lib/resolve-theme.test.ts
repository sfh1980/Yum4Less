import { describe, expect, it, vi } from "vitest";
import { resolveThemePreference } from "@/lib/resolve-theme";

describe("resolveThemePreference", () => {
  it("returns explicit light and dark preferences", () => {
    expect(resolveThemePreference("light")).toBe("light");
    expect(resolveThemePreference("dark")).toBe("dark");
  });

  it("defaults to light when window is unavailable (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(resolveThemePreference("system")).toBe("light");
    vi.unstubAllGlobals();
  });

  it("follows prefers-color-scheme for system preference", () => {
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({
        matches: query.includes("dark"),
      }),
    });

    expect(resolveThemePreference("system")).toBe("dark");

    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
    });

    expect(resolveThemePreference("system")).toBe("light");
    vi.unstubAllGlobals();
  });
});
