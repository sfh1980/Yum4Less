import {
  cloudflareYesterdayUtc,
  parseTunnelState,
  parseZoneErrorCount,
  readCloudflareMorningConfig,
  type CloudflareMorningFacts,
} from "@/lib/owner/cloudflare-morning";

const ANALYTICS_QUERY = `query ZoneDay($zoneTag: string, $date: Date) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(limit: 1, filter: { date_geq: $date, date_leq: $date }) {
        sum {
          responseStatusMap {
            edgeResponseStatus
            requests
          }
        }
      }
    }
  }
}`;

/** Null when the three ingest settings are absent. Never throws. */
export async function fetchCloudflareMorning(
  now = new Date(),
): Promise<CloudflareMorningFacts | null> {
  const config = readCloudflareMorningConfig();
  if (!config) {
    return null;
  }
  try {
    const headers = {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    };
    const signal = AbortSignal.timeout(8_000);
    const tunnelUrl = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/cfd_tunnel`,
    );
    tunnelUrl.searchParams.set("name", config.tunnelName);
    tunnelUrl.searchParams.set("is_deleted", "false");
    const [tunnelResponse, analyticsResponse] = await Promise.all([
      fetch(tunnelUrl, { headers, signal }),
      fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          query: ANALYTICS_QUERY,
          variables: {
            zoneTag: config.zoneId,
            date: cloudflareYesterdayUtc(now),
          },
        }),
      }),
    ]);
    if (!tunnelResponse.ok || !analyticsResponse.ok) {
      return { checked: false };
    }
    const tunnel = parseTunnelState(await tunnelResponse.json(), config.tunnelName);
    const errorCount = parseZoneErrorCount(await analyticsResponse.json());
    if (tunnel === null || errorCount === null) {
      return { checked: false };
    }
    return { checked: true, tunnel, errorCount };
  } catch {
    return { checked: false };
  }
}
