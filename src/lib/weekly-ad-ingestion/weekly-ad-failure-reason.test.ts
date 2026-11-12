import { describe, expect, it } from "vitest";
import { sanitizeWeeklyAdFailureReason } from "@/lib/weekly-ad-ingestion/weekly-ad-failure-reason";

describe("sanitizeWeeklyAdFailureReason", () => {
  it("drops urls, tokens, and store ids", () => {
    const text = sanitizeWeeklyAdFailureReason(
      "timeout at https://services.publix.com/api?token=abc store id 1968 bearer secretvalue and AAAAAAAAAAAAAAAAAAAAAAAA",
    );
    expect(text).not.toContain("https://");
    expect(text).not.toMatch(/\btoken\b/);
    expect(text).not.toContain("1968");
    expect(text).not.toContain("bearer");
    expect(text).toContain("timeout");
  });

  it("uses a short fallback when nothing readable remains", () => {
    expect(sanitizeWeeklyAdFailureReason("https://example.com/ad")).toBe(
      "the flyer fetch failed",
    );
  });
});
