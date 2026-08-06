import { describe, expect, it } from "vitest";
import { clampListLimit } from "@/lib/list-limit";

describe("clampListLimit", () => {
  it("returns the default for empty or invalid input", () => {
    expect(clampListLimit(null, 20)).toBe(20);
    expect(clampListLimit("", 20)).toBe(20);
    expect(clampListLimit("abc", 20)).toBe(20);
  });

  it("clamps to 1..max and floors fractions", () => {
    expect(clampListLimit("0", 20, 100)).toBe(1);
    expect(clampListLimit("50.9", 20, 100)).toBe(50);
    expect(clampListLimit("999", 20, 100)).toBe(100);
  });
});
