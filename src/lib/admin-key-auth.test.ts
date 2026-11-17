import { describe, expect, it } from "vitest";
import { adminKeysMatch, isRequestAuthorizedWithAdminKey } from "@/lib/admin-key-auth";

describe("isRequestAuthorizedWithAdminKey", () => {
  it("rejects when expected key is missing", () => {
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer secret" },
        }),
        undefined,
      ),
    ).toBe(false);
  });

  it("rejects blank expected keys", () => {
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer secret" },
        }),
        "   ",
      ),
    ).toBe(false);
  });

  it("accepts Authorization: Bearer when the key matches", () => {
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer secret" },
        }),
        "secret",
      ),
    ).toBe(true);
  });

  it("accepts X-Yum4Less-Admin-Key when the key matches", () => {
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { "X-Yum4Less-Admin-Key": "secret" },
        }),
        "secret",
      ),
    ).toBe(true);
  });

  it("rejects mismatched keys", () => {
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer wrong" },
        }),
        "secret",
      ),
    ).toBe(false);
  });

  it("rejects a key whose length differs from the configured key", () => {
    expect(adminKeysMatch("secret-extra", "secret")).toBe(false);
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer secret-extra" },
        }),
        "secret",
      ),
    ).toBe(false);
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { "X-Yum4Less-Admin-Key": "sec" },
        }),
        "secret",
      ),
    ).toBe(false);
  });

  it("rejects an empty configured key", () => {
    expect(
      isRequestAuthorizedWithAdminKey(
        new Request("http://localhost/", {
          headers: { Authorization: "Bearer " },
        }),
        "",
      ),
    ).toBe(false);
  });
});
