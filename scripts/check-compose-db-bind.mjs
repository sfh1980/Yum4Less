/**
 * Compose DB bind gate (Tier 2 SS-1) — fails when any Compose service publishes
 * a Postgres-like host port on all interfaces (0.0.0.0 / :: / unqualified).
 *
 * Intent: local-dev credentials (`postgres:postgres`) are acceptable on loopback
 * only. Unqualified `ports: "5433:5432"` publishes on every interface and is a
 * STOP-SHIP regression. Same philosophy as check:identity-ssot — fail the
 * pattern, not just the instance.
 *
 * Usage: node scripts/check-compose-db-bind.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Host ports we treat as database publish surfaces (host side of HOST:CONTAINER). */
const DB_HOST_PORTS = new Set(["5432", "5433"]);

/** Compose files to scan (repo root + common nest). */
const COMPOSE_NAME_RE = /^(docker-)?compose(\..+)?\.ya?ml$/i;

function toPosix(path) {
  return path.split(sep).join("/");
}

function walkComposeFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "backups") {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Keep shallow: root + one level (e.g. deploy/). Avoid scanning all of src/.
      const depth = relative(ROOT, full).split(sep).filter(Boolean).length;
      if (depth <= 1) {
        walkComposeFiles(full, out);
      }
    } else if (COMPOSE_NAME_RE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Extract short-syntax port publish strings from a Compose YAML file.
 * Handles `- "5433:5432"`, `- '127.0.0.1:5433:5432'`, and bare `- 5433:5432`.
 * Long-syntax `published:` / `host_ip:` blocks are also checked.
 */
function extractPortBindings(text) {
  const bindings = [];

  // Short syntax list items under ports:
  const shortRe =
    /^\s*-\s*["']?((?:\[[^\]]+\]|[^"'#\s]+):(\d+)(?::(\d+))?(?:\/(?:tcp|udp))?)["']?\s*(?:#.*)?$/gm;
  let match;
  while ((match = shortRe.exec(text)) !== null) {
    bindings.push({ raw: match[1], lineHint: match[0].trim() });
  }

  // Long syntax: published + optional host_ip nearby (best-effort window).
  const publishedRe = /published:\s*["']?(\d+)["']?/g;
  while ((match = publishedRe.exec(text)) !== null) {
    const start = Math.max(0, match.index - 200);
    const window = text.slice(start, match.index + 200);
    const hostIp = window.match(/host_ip:\s*["']?([^"'#\s]+)["']?/);
    const published = match[1];
    const host = hostIp ? hostIp[1] : "";
    const raw = host ? `${host}:${published}:${published}` : `${published}:${published}`;
    bindings.push({
      raw,
      lineHint: `published: ${published}${host ? ` (host_ip: ${host})` : " (no host_ip)"}`,
    });
  }

  return bindings;
}

/**
 * Parse Compose short-syntax port into { hostIp, hostPort, containerPort }.
 * Forms:
 *   CONTAINER
 *   HOST:CONTAINER
 *   IP:HOST:CONTAINER
 *   [IPv6]:HOST:CONTAINER
 */
function parseShortPort(raw) {
  const cleaned = raw.replace(/\/(tcp|udp)$/i, "");

  // [IPv6]:host:container
  const ipv6 = cleaned.match(/^\[([^\]]+)\]:(\d+):(\d+)$/);
  if (ipv6) {
    return { hostIp: ipv6[1], hostPort: ipv6[2], containerPort: ipv6[3] };
  }

  const parts = cleaned.split(":");
  if (parts.length === 1) {
    return { hostIp: "", hostPort: parts[0], containerPort: parts[0] };
  }
  if (parts.length === 2) {
    return { hostIp: "", hostPort: parts[0], containerPort: parts[1] };
  }
  if (parts.length === 3) {
    return { hostIp: parts[0], hostPort: parts[1], containerPort: parts[2] };
  }
  return { hostIp: "", hostPort: "", containerPort: "" };
}

function isLoopbackHost(hostIp) {
  const h = hostIp.trim().toLowerCase();
  return (
    h === "127.0.0.1" ||
    h === "localhost" ||
    h === "::1" ||
    h === "[::1]"
  );
}

function isAllInterfacesHost(hostIp) {
  const h = hostIp.trim().toLowerCase();
  return h === "" || h === "0.0.0.0" || h === "::" || h === "[::]";
}

function fail(message) {
  console.error(`check:compose-db-bind FAIL: ${message}`);
}

function main() {
  const failures = [];
  const composeFiles = walkComposeFiles(ROOT);

  if (composeFiles.length === 0) {
    failures.push("no docker-compose*.yml / compose*.yml found under repo root");
  }

  for (const full of composeFiles) {
    const posix = toPosix(relative(ROOT, full));
    const text = readFileSync(full, "utf8");
    const bindings = extractPortBindings(text);

    for (const { raw, lineHint } of bindings) {
      const { hostIp, hostPort, containerPort } = parseShortPort(raw);
      const looksLikeDb =
        DB_HOST_PORTS.has(hostPort) ||
        DB_HOST_PORTS.has(containerPort) ||
        /postgres|5432|5433/i.test(lineHint);

      if (!looksLikeDb) {
        continue;
      }

      if (isAllInterfacesHost(hostIp)) {
        failures.push(
          `${posix}: DB port published on all interfaces — ${lineHint}. ` +
            `Use 127.0.0.1:HOST:CONTAINER (loopback only).`,
        );
      } else if (!isLoopbackHost(hostIp)) {
        failures.push(
          `${posix}: DB port published on non-loopback host ${hostIp} — ${lineHint}. ` +
            `Loopback bind required for default local-dev credentials.`,
        );
      }
    }
  }

  // Sanity: root docker-compose.yml must exist and pass.
  try {
    statSync(join(ROOT, "docker-compose.yml"));
  } catch {
    failures.push("docker-compose.yml missing at repo root");
  }

  if (failures.length > 0) {
    for (const message of failures) {
      fail(message);
    }
    console.error(
      `\n${failures.length} compose DB bind violation(s). ` +
        `See scripts/check-compose-db-bind.mjs header.`,
    );
    process.exit(1);
  }

  console.log("check:compose-db-bind OK");
  process.exit(0);
}

main();
