import { describe, expect, it } from "vitest";
import { normalizeRecipeInstructionSteps } from "@/lib/recipe-instruction-steps";

describe("normalizeRecipeInstructionSteps", () => {
  it("removes decorative TheMealDB bullet-only lines", () => {
    expect(
      normalizeRecipeInstructionSteps([
        "Grate half an onion and set aside.",
        "▢",
        "Mix ground beef with spices.",
        "▢",
      ]),
    ).toEqual(["Grate half an onion and set aside.", "Mix ground beef with spices."]);
  });

  it("trims whitespace and drops empty lines", () => {
    expect(normalizeRecipeInstructionSteps(["  Step one  ", "", "Step two"])).toEqual([
      "Step one",
      "Step two",
    ]);
  });
});
