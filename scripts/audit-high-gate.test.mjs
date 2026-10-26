import { describe, expect, it } from "vitest";
import { judgeHighAudit } from "./audit-high-gate.mjs";

const bracesVia = {
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  severity: "high",
};

describe("judgeHighAudit", () => {
  it("blocks a high braces chain", () => {
    const result = judgeHighAudit({
      vulnerabilities: {
        braces: { severity: "high", via: [bracesVia] },
        micromatch: { severity: "high", via: ["braces"] },
        "eslint-config-next": { severity: "high", via: ["micromatch"] },
        vitest: { severity: "moderate", via: [{ url: "https://example.test/moderate", severity: "moderate" }] },
      },
    });

    expect(result.blocking.map((item) => item.name)).toEqual([
      "braces",
      "micromatch",
      "eslint-config-next",
    ]);
  });

  it("blocks a different high advisory", () => {
    const result = judgeHighAudit({
      vulnerabilities: {
        sharp: {
          severity: "high",
          via: [{ url: "https://github.com/advisories/GHSA-wq5f-xc86-pv6w", severity: "high" }],
        },
        next: { severity: "high", via: ["sharp"] },
      },
    });

    expect(result.blocking.map((item) => item.name)).toEqual(["sharp", "next"]);
  });

  it("blocks a package that mixes braces with another advisory", () => {
    const result = judgeHighAudit({
      vulnerabilities: {
        braces: { severity: "high", via: [bracesVia] },
        "eslint-config-next": {
          severity: "high",
          via: [
            "braces",
            { url: "https://github.com/advisories/GHSA-other-other-other", severity: "high" },
          ],
        },
      },
    });

    expect(result.blocking.map((item) => item.name)).toEqual(["braces", "eslint-config-next"]);
  });

  it("passes when the report has no high or critical findings", () => {
    const result = judgeHighAudit({ vulnerabilities: {} });
    expect(result.blocking).toEqual([]);
  });
});
