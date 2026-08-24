import { describe, expect, it } from "vitest";
import {
  formatLockedTabMessage,
  parseOnboardingStep,
  previousOnboardingStep,
  remainingSetupStepCount,
  resolveResumeOnboardingStep,
} from "@/components/meal-planner/onboarding-step";

describe("onboarding step machine", () => {
  it("parses known steps and rejects junk", () => {
    expect(parseOnboardingStep("radius")).toBe("radius");
    expect(parseOnboardingStep("nope")).toBeUndefined();
  });

  it("counts remaining setup items from the current screen", () => {
    expect(remainingSetupStepCount("choose-location", false)).toBe(4);
    expect(remainingSetupStepCount("zip-pin", false)).toBe(4);
    expect(remainingSetupStepCount("radius", false)).toBe(3);
    expect(remainingSetupStepCount("shopping-style", false)).toBe(2);
    expect(remainingSetupStepCount("stores", false)).toBe(1);
    expect(remainingSetupStepCount("stores", true)).toBe(0);
  });

  it("formats locked-tab copy from the remaining count", () => {
    expect(formatLockedTabMessage(4)).toBe("4 steps needed before this works");
    expect(formatLockedTabMessage(1)).toBe("1 step needed before this works");
  });

  it("walks Back to the previous wizard screen", () => {
    expect(previousOnboardingStep("zip-input", undefined)).toBe("choose-location");
    expect(previousOnboardingStep("zip-pin", "zip")).toBe("zip-input");
    expect(previousOnboardingStep("radius", "geolocation")).toBe("choose-location");
    expect(previousOnboardingStep("radius", "zip")).toBe("zip-pin");
    expect(previousOnboardingStep("choose-location", undefined)).toBeNull();
  });

  it("resumes a saved step and does not restore splash", () => {
    expect(resolveResumeOnboardingStep("stores", "zip")).toBe("stores");
    expect(resolveResumeOnboardingStep("splash", "zip")).toBe("choose-location");
    expect(resolveResumeOnboardingStep("zip-pin", "geolocation")).toBe(
      "choose-location",
    );
  });
});
