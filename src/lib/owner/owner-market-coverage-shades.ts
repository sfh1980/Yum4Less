import type { ActiveMarketRow } from "@/lib/active-markets";
import { resolveZctaGeometry } from "@/lib/geo/zcta-boundary";
import type { OwnerMarketCoverageShade } from "@/lib/owner/owner-market-coverage-map-model";

export async function listOwnerMarketCoverageShades(
  markets: Pick<ActiveMarketRow, "zipCode" | "status">[],
): Promise<OwnerMarketCoverageShade[]> {
  const shades: OwnerMarketCoverageShade[] = [];

  for (const market of markets) {
    if (market.status !== "active" && market.status !== "paused") {
      continue;
    }
    const zcta = await resolveZctaGeometry({ zipCode: market.zipCode });
    if (!zcta.ok) {
      continue;
    }
    shades.push({
      zipCode: market.zipCode,
      status: market.status,
      geometry: zcta.geometry,
    });
  }

  return shades;
}
