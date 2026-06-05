import { describe, expect, it } from "vitest";
import { validateFeedbackPayload } from "@/lib/feedback/feedback-validation";

describe("validateFeedbackPayload", () => {
  it("accepts a minimal wrong-price report", () => {
    const result = validateFeedbackPayload({
      issueType: "wrong_price",
      chainLabel: "Kroger",
      productDescription: "boneless chicken breast",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedback).toEqual({
        issueType: "wrong_price",
        chainLabel: "Kroger",
        productDescription: "boneless chicken breast",
        note: undefined,
      });
    }
  });

  it("rejects forbidden location and pricing fields", () => {
    const result = validateFeedbackPayload({
      issueType: "general",
      zipCode: "23111",
      note: "test",
    });

    expect(result).toEqual({
      ok: false,
      error: "Feedback payload includes disallowed data.",
    });
  });

  it("requires chain or product context for store-item reports", () => {
    const result = validateFeedbackPayload({
      issueType: "stale_ad",
      note: "weekly ad looked old",
    });

    expect(result).toEqual({
      ok: false,
      error: "Wrong-price and store-item reports need a chain label or product description.",
    });
  });
});
