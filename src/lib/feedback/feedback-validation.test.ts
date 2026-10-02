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

  it("accepts a grocery-store request that names the store", () => {
    const result = validateFeedbackPayload({
      issueType: "missing_store",
      chainLabel: "Harris Teeter",
      note: "Short Pump",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedback.issueType).toBe("missing_store");
      expect(result.feedback.chainLabel).toBe("Harris Teeter");
    }
  });

  it("rejects a grocery-store request that does not name the store", () => {
    const result = validateFeedbackPayload({
      issueType: "missing_store",
      note: "Please add my store",
    });

    expect(result).toEqual({
      ok: false,
      error: "Name the grocery store you want us to look into.",
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
