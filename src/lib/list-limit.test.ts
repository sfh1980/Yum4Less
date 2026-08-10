import { describe, expect, it } from "vitest";
import { clampListLimit, clampListOffset } from "@/lib/list-limit";

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

describe("clampListOffset", () => {
  it("returns 0 for empty or invalid input", () => {
    expect(clampListOffset(null)).toBe(0);
    expect(clampListOffset("")).toBe(0);
    expect(clampListOffset("-3")).toBe(0);
    expect(clampListOffset("nope")).toBe(0);
  });

  it("floors a non-negative offset", () => {
    expect(clampListOffset("50")).toBe(50);
    expect(clampListOffset("12.9")).toBe(12);
  });
});
