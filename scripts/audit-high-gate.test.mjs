import { describe, expect, it } from "vitest";
import {
  judgeHighAudit,
  PICOMATCH_EXCEPTION_EXPIRED_LINE,
  PICOMATCH_EXCEPTION_IN_USE_LINE,
} from "./audit-high-gate.mjs";

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

const picomatchVia = {
  url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
  severity: "high",
};

const picomatchReport = {
  vulnerabilities: {
    picomatch: { severity: "high", via: [picomatchVia] },
    vite: { severity: "high", via: ["picomatch"] },
  },
};

describe("picomatch advisory exception", () => {
  it("applies through 2026-12-15 when the runtime audit is clean", () => {
    const result = judgeHighAudit(picomatchReport, {
      now: "2026-12-15",
      runtimeHasHighOrCritical: false,
    });

    expect(result.blocking).toEqual([]);
    expect(result.exception.inUse).toBe(true);
    expect(result.exception.expiresOn).toBe("2026-12-15");
    expect(PICOMATCH_EXCEPTION_IN_USE_LINE).toBe(
      "high audit: exception GHSA-fc5q-39xc-vjpf is in use and expires on 2026-12-15.",
    );
  });

  it("fails after 2026-12-15 and names the advisory", () => {
    const result = judgeHighAudit(picomatchReport, {
      now: "2026-12-16",
      runtimeHasHighOrCritical: false,
    });

    expect(result.blocking.map((item) => item.name)).toEqual(["picomatch", "vite"]);
    expect(result.exception.inUse).toBe(false);
    expect(result.exception.expired).toBe(true);
    expect(PICOMATCH_EXCEPTION_EXPIRED_LINE).toContain("GHSA-fc5q-39xc-vjpf");
    expect(PICOMATCH_EXCEPTION_EXPIRED_LINE).toContain("Check for a patched picomatch");
  });

  it("does not apply when the runtime audit has a high or critical issue", () => {
    const result = judgeHighAudit(picomatchReport, {
      now: "2026-11-17",
      runtimeHasHighOrCritical: true,
    });

    expect(result.exception.inUse).toBe(false);
    expect(result.exception.runtimeAffected).toBe(true);
    expect(result.blocking.map((item) => item.name)).toEqual(["picomatch", "vite"]);
  });

  it("still fails a different advisory id", () => {
    const result = judgeHighAudit(
      {
        vulnerabilities: {
          vite: { severity: "high", via: [picomatchVia] },
          picomatch: {
            severity: "high",
            via: [{ url: "https://github.com/advisories/GHSA-wq5f-xc86-pv6w", severity: "high" }],
          },
        },
      },
      { now: "2026-11-17", runtimeHasHighOrCritical: false },
    );

    expect(result.exception.inUse).toBe(true);
    expect(result.blocking.map((item) => item.name)).toEqual(["picomatch"]);
  });
});
