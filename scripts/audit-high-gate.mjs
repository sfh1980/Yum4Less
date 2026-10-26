/**
 * High-severity npm audit gate for CI image publish.
 *
 * Fails on any high or critical advisory.
 *
 * Usage: npm run audit:high
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * @param {{ vulnerabilities?: Record<string, { severity?: string, via?: unknown[] }> }} report
 * @returns {{ blocking: { name: string, severity: string, advisoryUrls: string[] }[] }}
 */
export function judgeHighAudit(report) {
  const vulns = report?.vulnerabilities ?? {};
  const blocking = [];

  function roots(name, seen = new Set()) {
    if (seen.has(name)) return [];
    seen.add(name);
    const entry = vulns[name];
    if (!entry) return [];
    const found = [];
    for (const via of entry.via ?? []) {
      if (typeof via === "string") {
        found.push(...roots(via, seen));
      } else if (via && typeof via === "object" && "url" in via) {
        found.push(String(via.url));
      }
    }
    return found;
  }

  for (const [name, entry] of Object.entries(vulns)) {
    if (entry.severity !== "high" && entry.severity !== "critical") continue;
    const advisoryUrls = roots(name);
    blocking.push({ name, severity: entry.severity, advisoryUrls });
  }

  return { blocking };
}

function loadAuditReport() {
  const result = spawnSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const stdout = result.stdout ?? "";
  if (!stdout.trim()) {
    const stderr = result.stderr ?? "";
    throw new Error(stderr || `npm audit exited ${result.status}`);
  }
  return JSON.parse(stdout);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url.toLowerCase() === pathToFileURL(entry).href.toLowerCase();
}

if (isDirectRun()) {
  const report = loadAuditReport();
  const { blocking } = judgeHighAudit(report);
  if (blocking.length > 0) {
    for (const item of blocking) {
      const urls = item.advisoryUrls.length > 0 ? item.advisoryUrls.join(" ") : "no advisory url";
      console.error(`high audit: ${item.name} (${item.severity}) ${urls}`);
    }
    process.exit(1);
  }
  console.log("high audit: no high or critical advisories.");
}
