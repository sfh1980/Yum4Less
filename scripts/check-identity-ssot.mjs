/**
 * Identity SSOT gate (Option A follow-up) — fails CI when a second client
 * identity resolution path appears for seed pairs that already have one path.
 *
 * Intent (Settings vs Map):
 * - Settings known-pair (`SETTINGS_KNOWN_KROGER_*` in
 *   store-identity-settings-lookup.ts) is an intentional temporary SSOT for
 *   Settings checkbox remap only.
 * - Map / market client filtering must consume server `equivalentStoreIds`
 *   (Postgres-backed expand) — not a second hardcoded pair table.
 * - Aldi ingest pointer allowlist (store-identity-ingest-aliases.ts) is a
 *   write-policy allowlist (source_name), not a client identity mirror.
 *
 * Known gap (accepted): co-occurrence is per-file only. A deliberately split
 * static pair graph across two files would evade A2/A3. That is narrower than
 * the 5b failure mode and is not closed in this pass.
 *
 * Usage: node scripts/check-identity-ssot.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Seed twin pairs — both members in one production file + graph signal = fail. */
const SEED_PAIRS = [
  {
    name: "kroger-022",
    left: "kroger-02900529",
    right: "kroger-mechanicsville",
  },
  {
    name: "aldi-023",
    left: "aldi-mechanicsville",
    right: "osm-node-6531578976",
  },
];

const SETTINGS_KNOWN_CONSTANTS = [
  "SETTINGS_KNOWN_KROGER_CANONICAL_ID",
  "SETTINGS_KNOWN_KROGER_ALIAS_ID",
];

/** A1 — SETTINGS_KNOWN_KROGER_* may only appear here. */
const A1_ALLOWLIST = new Set([
  "src/lib/store-identity-settings-lookup.ts",
  "src/lib/store-identity-settings-canonicalize.test.ts",
]);

/**
 * A2/A3 — production files allowed to co-locate seed pair ids with a static
 * memory identity graph (or type-backed graph builder). New files must be
 * added here deliberately — omission is not an exemption.
 */
const A2_A3_ALLOWLIST = new Set([
  "src/lib/store-identity-settings-lookup.ts",
  "src/lib/fixtures/store-identity.fixtures.ts",
  "src/lib/store-identity-resolvers.ts",
  "src/lib/store-identity-postgres-lookup.ts",
  "src/lib/store-identity-ingest-aliases.ts",
]);

/** Data / probe SSOT (not scanned as client production graphs). */
const DATA_PROBE_EXEMPT = new Set([
  "db/init/022_seed_kroger_mechanicsville_identity.sql",
  "db/init/023_seed_aldi_mechanicsville_identity.sql",
  "scripts/lib/apply-migrations.mjs",
  "scripts/lib/apply-migrations.test.mjs",
]);

const GRAPH_SIGNAL_RE =
  /createMemoryStoreIdentityLookup\s*\(|\bStoreIdentityRecord\b|\bStoreIdentityAliasRecord\b/;

function toPosix(path) {
  return path.split(sep).join("/");
}

function isTestOrE2ePath(posixPath) {
  if (posixPath.startsWith("e2e/")) {
    return true;
  }
  return /\.(test|integration\.test)\.(ts|tsx|mjs|js)$/.test(posixPath);
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "backups") {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function fail(message) {
  console.error(`check:identity-ssot FAIL: ${message}`);
}

function main() {
  const failures = [];

  const srcRoot = join(ROOT, "src");
  const files = walkFiles(srcRoot).map((full) => ({
    full,
    posix: toPosix(relative(ROOT, full)),
  }));

  for (const { full, posix } of files) {
    const text = readFileSync(full, "utf8");

    // A1 — SETTINGS_KNOWN_KROGER_* outside allowlist (tests included; only two files OK).
    for (const constant of SETTINGS_KNOWN_CONSTANTS) {
      if (text.includes(constant) && !A1_ALLOWLIST.has(posix)) {
        failures.push(
          `${posix}: ${constant} is only allowed in ${[...A1_ALLOWLIST].join(", ")}`,
        );
      }
    }

    if (isTestOrE2ePath(posix) || A2_A3_ALLOWLIST.has(posix)) {
      continue;
    }

    // A2/A3 — both seed pair members + static graph signal in one production file.
    if (!GRAPH_SIGNAL_RE.test(text)) {
      continue;
    }

    for (const pair of SEED_PAIRS) {
      if (text.includes(pair.left) && text.includes(pair.right)) {
        failures.push(
          `${posix}: seed pair ${pair.name} (${pair.left} + ${pair.right}) ` +
            `co-occurs with createMemoryStoreIdentityLookup / StoreIdentityRecord(Alias) — ` +
            `Map must use equivalentStoreIds; add to A2_A3_ALLOWLIST only if intentional`,
        );
      }
    }
  }

  // Sanity: exempt data/probe paths exist (typo guard).
  for (const exempt of DATA_PROBE_EXEMPT) {
    try {
      statSync(join(ROOT, exempt));
    } catch {
      failures.push(`DATA_PROBE_EXEMPT missing: ${exempt}`);
    }
  }

  // Explicit non-allowlist: map pin resolve must not grow a static pair graph.
  const mapPin = "src/lib/store-identity-map-pin-resolve.ts";
  if (A2_A3_ALLOWLIST.has(mapPin)) {
    failures.push(`${mapPin} must not be on A2_A3_ALLOWLIST`);
  }

  if (failures.length > 0) {
    for (const message of failures) {
      fail(message);
    }
    console.error(
      `\n${failures.length} identity SSOT violation(s). ` +
        `See scripts/check-identity-ssot.mjs header for Settings vs Map policy.`,
    );
    process.exit(1);
  }

  console.log("check:identity-ssot OK");
  process.exit(0);
}

main();
