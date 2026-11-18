/**
 * High-severity npm audit gate for CI image publish.
 *
 * Fails on any high or critical advisory.
 *
 * GHSA-fc5q-39xc-vjpf is ignored through the UTC day 2026-12-15 when
 * `npm audit --omit=dev` reports no high or critical issue. The match is that
 * advisory id on the advisory URL. A package name or a severity does not match.
 * After 2026-12-15 the gate fails and tells the owner to check for a patched picomatch.
 *
 * Usage: npm run audit:high
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PICOMATCH_ADVISORY_ID = "GHSA-fc5q-39xc-vjpf";
export const PICOMATCH_ADVISORY_EXPIRES_ON = "2026-12-15";

export const PICOMATCH_EXCEPTION_IN_USE_LINE =
  "high audit: exception GHSA-fc5q-39xc-vjpf is in use and expires on 2026-12-15.";

export const PICOMATCH_EXCEPTION_EXPIRED_LINE =
  "high audit: GHSA-fc5q-39xc-vjpf expired on 2026-12-15. Check for a patched picomatch.";

/**
 * @param {unknown} now
 * @returns {string}
 */
function calendarDate(now) {
  if (typeof now === "string" && /^\d{4}-\d{2}-\d{2}$/.test(now)) return now;
  const date = now instanceof Date ? now : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error("audit gate clock is invalid");
  }
  return date.toISOString().slice(0, 10);
}

/**
 * @param {string[]} urls
 * @returns {string[]}
 */
function advisoryIds(urls) {
  const ids = new Set();
  for (const url of urls) {
    const matches = String(url).match(new RegExp("GHSA-[a-z0-9-]+", "gi"));
    if (!matches) continue;
    for (const match of matches) ids.add(match.toLowerCase());
  }
  return [...ids];
}

/**
 * @param {{ vulnerabilities?: Record<string, { severity?: string }> }} report
 * @returns {boolean}
 */
export function runtimeAuditHasHighOrCritical(report) {
  const vulns = report?.vulnerabilities ?? {};
  return Object.values(vulns).some(
    (entry) => entry?.severity === "high" || entry?.severity === "critical",
  );
}

/**
 * @param {{ vulnerabilities?: Record<string, { severity?: string, via?: unknown[] }> }} report
 * @param {{ now?: string | Date, runtimeHasHighOrCritical?: boolean }} [options]
 * @returns {{
 *   blocking: { name: string, severity: string, advisoryUrls: string[] }[],
 *   exception: {
 *     id: string,
 *     expiresOn: string,
 *     inUse: boolean,
 *     expired: boolean,
 *     runtimeAffected: boolean,
 *   },
 * }}
 */
export function judgeHighAudit(report, options = {}) {
  const vulns = report?.vulnerabilities ?? {};
  const found = [];

  function roots(name, seen = new Set()) {
    if (seen.has(name)) return [];
    seen.add(name);
    const entry = vulns[name];
    if (!entry) return [];
    const urls = [];
    for (const via of entry.via ?? []) {
      if (typeof via === "string") {
        urls.push(...roots(via, seen));
      } else if (via && typeof via === "object" && "url" in via) {
        urls.push(String(via.url));
      }
    }
    return urls;
  }

  for (const [name, entry] of Object.entries(vulns)) {
    if (entry.severity !== "high" && entry.severity !== "critical") continue;
    found.push({ name, severity: entry.severity, advisoryUrls: roots(name) });
  }

  const today = calendarDate(options.now);
  const expired = today > PICOMATCH_ADVISORY_EXPIRES_ON;
  const runtimeAffected = options.runtimeHasHighOrCritical === true;
  const exceptionAllowed = !expired && !runtimeAffected;
  const targetId = PICOMATCH_ADVISORY_ID.toLowerCase();
  const blocking = [];
  let suppressed = false;
  let sawPicomatchAdvisory = false;

  for (const item of found) {
    const ids = advisoryIds(item.advisoryUrls);
    const onlyThisAdvisory = ids.length > 0 && ids.every((id) => id === targetId);
    if (ids.includes(targetId)) sawPicomatchAdvisory = true;
    if (onlyThisAdvisory && exceptionAllowed) {
      suppressed = true;
      continue;
    }
    blocking.push(item);
  }

  return {
    blocking,
    exception: {
      id: PICOMATCH_ADVISORY_ID,
      expiresOn: PICOMATCH_ADVISORY_EXPIRES_ON,
      inUse: suppressed,
      expired: expired && sawPicomatchAdvisory,
      runtimeAffected: runtimeAffected && sawPicomatchAdvisory,
    },
  };
}

/**
 * @param {string[]} args
 */
function loadAuditReport(args) {
  const result = spawnSync("npm", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const stdout = result.stdout ?? "";
  if (!stdout.trim()) {
    const stderr = result.stderr ?? "";
    throw new Error(stderr || `npm ${args.join(" ")} exited ${result.status}`);
  }
  return JSON.parse(stdout);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url.toLowerCase() === pathToFileURL(entry).href.toLowerCase();
}

if (isDirectRun()) {
  const report = loadAuditReport(["audit", "--json"]);
  const runtimeReport = loadAuditReport(["audit", "--omit=dev", "--json"]);
  const runtimeHasHighOrCritical = runtimeAuditHasHighOrCritical(runtimeReport);
  const { blocking, exception } = judgeHighAudit(report, {
    now: new Date(),
    runtimeHasHighOrCritical,
  });

  if (exception.inUse) {
    console.log(PICOMATCH_EXCEPTION_IN_USE_LINE);
  }
  if (exception.expired) {
    console.error(PICOMATCH_EXCEPTION_EXPIRED_LINE);
  }
  if (exception.runtimeAffected) {
    console.error(
      "high audit: GHSA-fc5q-39xc-vjpf exception does not apply because npm audit --omit=dev reports a high or critical issue.",
    );
  }
  if (blocking.length > 0 || runtimeHasHighOrCritical) {
    for (const item of blocking) {
      const urls = item.advisoryUrls.length > 0 ? item.advisoryUrls.join(" ") : "no advisory url";
      console.error(`high audit: ${item.name} (${item.severity}) ${urls}`);
    }
    if (blocking.length === 0) {
      console.error("high audit: npm audit --omit=dev reports a high or critical issue.");
    }
    process.exit(1);
  }
  console.log("high audit: no high or critical advisories.");
}
