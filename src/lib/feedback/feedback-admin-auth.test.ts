import { afterEach, describe, expect, it } from "vitest";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";

const originalAdminKey = process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;

describe("isFeedbackListAuthorized", () => {
  afterEach(() => {
    if (originalAdminKey === undefined) {
      delete process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;
    } else {
      process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = originalAdminKey;
    }
  });

  it("rejects requests when the admin key is not configured", () => {
    delete process.env.YUM4LESS_FEEDBACK_ADMIN_KEY;

    expect(
      isFeedbackListAuthorized(
        new Request("http://localhost/api/feedback", {
          headers: { Authorization: "Bearer secret" },
        }),
      ),
    ).toBe(false);
  });

  it("accepts Authorization: Bearer when the key matches", () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";

    expect(
      isFeedbackListAuthorized(
        new Request("http://localhost/api/feedback", {
          headers: { Authorization: "Bearer secret" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts X-Yum4Less-Admin-Key when the key matches", () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";

    expect(
      isFeedbackListAuthorized(
        new Request("http://localhost/api/feedback", {
          headers: { "X-Yum4Less-Admin-Key": "secret" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects mismatched keys", () => {
    process.env.YUM4LESS_FEEDBACK_ADMIN_KEY = "secret";

    expect(
      isFeedbackListAuthorized(
        new Request("http://localhost/api/feedback", {
          headers: { Authorization: "Bearer wrong" },
        }),
      ),
    ).toBe(false);
  });
});
