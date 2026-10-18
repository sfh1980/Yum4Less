/** Plain Cloudflare lines for the morning note. No raw logs, IPs, or page addresses. */

const HEX_32 = /^[a-f0-9]{32}$/i;

export const DEFAULT_CLOUDFLARE_TUNNEL_NAME = "truenas-homelab";

export type CloudflareTunnelState = "connected" | "degraded" | "down";

export type CloudflareMorningFacts =
  | { checked: false }
  | {
      checked: true;
      tunnel: CloudflareTunnelState;
      errorCount: number;
    };

export type CloudflareMorningConfig = {
  accountId: string;
  zoneId: string;
  token: string;
  tunnelName: string;
};

export function readCloudflareMorningConfig(
  env: Record<string, string | undefined> = process.env,
): CloudflareMorningConfig | null {
  const accountId = env.YUM4LESS_CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const zoneId = env.YUM4LESS_CLOUDFLARE_ZONE_ID?.trim() ?? "";
  const token = env.YUM4LESS_CLOUDFLARE_API_TOKEN?.trim() ?? "";
  const tunnelName =
    env.YUM4LESS_CLOUDFLARE_TUNNEL_NAME?.trim() || DEFAULT_CLOUDFLARE_TUNNEL_NAME;
  if (!HEX_32.test(accountId) || !HEX_32.test(zoneId) || !token) {
    return null;
  }
  return { accountId, zoneId, token, tunnelName };
}

/** UTC calendar day before `now`. Cloudflare's daily totals use that date. */
export function cloudflareYesterdayUtc(now = new Date()): string {
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  return yesterday.toISOString().slice(0, 10);
}

export function parseTunnelState(
  body: unknown,
  tunnelName: string,
): CloudflareTunnelState | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const result = (body as { success?: unknown; result?: unknown }).result;
  if ((body as { success?: unknown }).success !== true || !Array.isArray(result)) {
    return null;
  }
  const match = result.find(
    (row) =>
      row &&
      typeof row === "object" &&
      (row as { name?: unknown }).name === tunnelName,
  );
  if (!match || typeof match !== "object") {
    return "down";
  }
  const status = (match as { status?: unknown }).status;
  if (status === "healthy") {
    return "connected";
  }
  if (status === "degraded") {
    return "degraded";
  }
  return "down";
}

export function parseZoneErrorCount(body: unknown): number | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as {
    errors?: unknown;
    data?: { viewer?: { zones?: unknown } };
  };
  if (Array.isArray(record.errors) && record.errors.length > 0) {
    return null;
  }
  const zones = record.data?.viewer?.zones;
  if (!Array.isArray(zones) || zones.length === 0) {
    return null;
  }
  const groups = (zones[0] as { httpRequests1dGroups?: unknown }).httpRequests1dGroups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return 0;
  }
  const statusMap = (
    groups[0] as { sum?: { responseStatusMap?: unknown } }
  ).sum?.responseStatusMap;
  if (!Array.isArray(statusMap)) {
    return 0;
  }
  let errors = 0;
  for (const row of statusMap) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const status = (row as { edgeResponseStatus?: unknown }).edgeResponseStatus;
    const requests = (row as { requests?: unknown }).requests;
    if (
      typeof status === "number" &&
      status >= 500 &&
      status <= 599 &&
      typeof requests === "number" &&
      Number.isFinite(requests) &&
      requests > 0
    ) {
      errors += requests;
    }
  }
  return errors;
}

export function describeCloudflareMorning(facts: CloudflareMorningFacts): {
  lines: string[];
  needsAttention: boolean;
} {
  if (!facts.checked) {
    return { lines: ["Cloudflare was not checked."], needsAttention: true };
  }
  const lines: string[] = [];
  if (facts.tunnel === "down") {
    lines.push("The tunnel was not connected.");
  } else if (facts.tunnel === "degraded") {
    lines.push("The tunnel was not fully connected.");
  } else if (facts.errorCount === 0) {
    lines.push("Cloudflare saw the site up. The tunnel is connected.");
  }
  if (facts.errorCount > 0) {
    const count = Math.floor(facts.errorCount);
    lines.push(`Cloudflare saw ${count} ${count === 1 ? "error" : "errors"}.`);
  }
  const needsAttention = facts.tunnel !== "connected" || facts.errorCount > 0;
  return { lines, needsAttention };
}
