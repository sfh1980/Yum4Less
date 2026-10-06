import { describe, expect, it } from "vitest";
import { BRACES_ADVISORY, judgeHighAudit } from "./audit-high-gate.mjs";

const bracesVia = {
  url: `https://github.com/advisories/${BRACES_ADVISORY}`,
  severity: "high",
};

describe("judgeHighAudit", () => {
  it("allows the unpatched braces chain and nothing else", () => {
    const result = judgeHighAudit({
      vulnerabilities: {
        braces: { severity: "high", via: [bracesVia] },
        micromatch: { severity: "high", via: ["braces"] },
        "eslint-config-next": { severity: "high", via: ["micromatch"] },
        vitest: { severity: "moderate", via: [{ url: "https://example.test/moderate", severity: "moderate" }] },
      },
    });

    expect(result.blocking).toEqual([]);
    expect(result.bracesPresent).toBe(true);
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

    expect(result.bracesPresent).toBe(false);
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

    expect(result.blocking.map((item) => item.name)).toEqual(["eslint-config-next"]);
  });

  it("reports the braces exception unused when the report has no high findings", () => {
    const result = judgeHighAudit({ vulnerabilities: {} });
    expect(result.blocking).toEqual([]);
    expect(result.bracesPresent).toBe(false);
  });
});
