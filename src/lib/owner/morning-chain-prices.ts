import { inferStoreChainFromCatalog } from "@/lib/chain-rollout-policy";
import { getDbPool } from "@/lib/db";
import { queryRankedPriceFreshness } from "@/lib/ingest/ingest-freshness-heartbeat";
import { resolveLocationInput } from "@/lib/location-resolution";
import { loadCatalogStores } from "@/lib/market-catalog-repository";
import {
  resolveIngestFenceForZip,
  storePassesIngestFence,
} from "@/lib/market-ingest-fence";
import type { MorningChainPriceFact } from "@/lib/owner/morning-report";
import { getRankedPriceSourceKind } from "@/lib/price-source-policy";
import { logServerError } from "@/lib/server-log";
import { filterCatalogStoresNearLocation } from "@/lib/store-catalog-sync";
import { isWeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";

export type MorningChainRegistryRow = {
  chainId: string;
  displayName: string;
  saleSource: boolean;
  sortOrder: number;
  priceMissReason?: string | null;
};

/** Map a ranked price source onto a chain and whether the row is official or a flyer. */
export function priceSourceFreshnessKind(
  sourceName: string,
): { chainId: string; kind: "official" | "flyer" } | null {
  const kind = getRankedPriceSourceKind(sourceName);
  if (kind === "official-online") {
    const chainId = sourceName.replace(/-(?:official|online)-api$/, "");
    return chainId ? { chainId, kind: "official" } : null;
  }
  if (kind === "weekly-ad") {
    const chainId = sourceName.replace(/-weekly-ad-scrape$/, "");
    return chainId ? { chainId, kind: "flyer" } : null;
  }
  return null;
}

export function assembleMorningChainPriceFacts(input: {
  registry: readonly MorningChainRegistryRow[];
  admittedChainIds: ReadonlySet<string>;
  freshBySource: readonly { sourceName: string; freshCount: number }[];
}): MorningChainPriceFact[] {
  const freshOfficial = new Map<string, number>();
  const freshFlyer = new Map<string, number>();
  for (const row of input.freshBySource) {
    const parsed = priceSourceFreshnessKind(row.sourceName);
    if (!parsed) {
      continue;
    }
    const target = parsed.kind === "official" ? freshOfficial : freshFlyer;
    target.set(parsed.chainId, (target.get(parsed.chainId) ?? 0) + row.freshCount);
  }

  return [...input.registry]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.displayName.localeCompare(right.displayName),
    )
    .map((row) => {
      const fact: MorningChainPriceFact = {
        displayName: row.displayName.trim(),
        admittedStore: input.admittedChainIds.has(row.chainId),
        saleSource: row.saleSource,
        freshOfficialCount: freshOfficial.get(row.chainId) ?? 0,
        freshFlyerCount: freshFlyer.get(row.chainId) ?? 0,
      };
      if (row.priceMissReason) {
        fact.priceMissReason = row.priceMissReason;
      }
      return fact;
    });
}

export async function loadMorningChainPriceFacts(input: {
  activeZipCodes: readonly string[];
}): Promise<MorningChainPriceFact[]> {
  const pool = getDbPool();
  const registryResult = await pool.query<{
    chain_id: string;
    display_name: string;
    sale_discovery_strategy: string;
    sort_order: number;
  }>(
    `
      select chain_id, display_name, sale_discovery_strategy, sort_order
      from chain_registry
      order by sort_order asc, display_name asc
    `,
  );
  const freshness = await queryRankedPriceFreshness(pool);
  const admittedChainIds = await listAdmittedChainIds(input.activeZipCodes);
  const missReasons = await loadPriceMissReasons(pool);
  return assembleMorningChainPriceFacts({
    registry: registryResult.rows.map((row) => ({
      chainId: row.chain_id,
      displayName: row.display_name,
      saleSource: row.sale_discovery_strategy.trim().toLowerCase() !== "none",
      sortOrder: row.sort_order,
      priceMissReason: missReasons.get(row.chain_id) ?? null,
    })),
    admittedChainIds,
    freshBySource: freshness.bySource,
  });
}

/**
 * Last miss reason per chain. A database that has not applied 043 yet
 * returns an empty map so the note still uses the generic sentence.
 */
async function loadPriceMissReasons(
  pool: ReturnType<typeof getDbPool>,
): Promise<Map<string, string>> {
  try {
    const result = await pool.query<{ chain: string; price_miss_reason: string }>(
      `
        select chain, price_miss_reason
        from weekly_ad_flyer_hashes
        where price_miss_reason is not null
          and btrim(price_miss_reason) <> ''
      `,
    );
    return new Map(
      result.rows
        .filter((row) => row.chain && row.price_miss_reason)
        .map((row) => [row.chain, row.price_miss_reason.trim()]),
    );
  } catch (error) {
    logServerError("morning-report.price-miss-reason", error);
    return new Map();
  }
}

/**
 * Chains with a catalog store inside an active ZIP's ingest fence.
 * Same fence the weekly-ad night uses. This walk is separate from that script.
 */
async function listAdmittedChainIds(
  activeZipCodes: readonly string[],
): Promise<Set<string>> {
  const admitted = new Set<string>();
  const stores = await loadCatalogStores();
  for (const zipCode of activeZipCodes) {
    const locationResult = await resolveLocationInput({ zipCode });
    if (!locationResult.ok) {
      continue;
    }
    const fence = await resolveIngestFenceForZip(zipCode);
    const nearby = filterCatalogStoresNearLocation(
      stores,
      locationResult.location,
      fence.ingestMiles,
    ).filter((store) =>
      storePassesIngestFence({
        latitude: store.latitude,
        longitude: store.longitude,
        center: locationResult.location,
        fence,
      }),
    );
    for (const store of nearby) {
      const chain = inferStoreChainFromCatalog(store);
      if (isWeeklyAdChain(chain)) {
        admitted.add(chain);
      }
    }
  }
  return admitted;
}

export function logMorningChainPriceFailure(error: unknown) {
  logServerError("morning-report.chain-prices", error);
}
