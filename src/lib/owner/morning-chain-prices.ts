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
import { getRankedPriceSourceKind, RANKED_PRICE_SOURCE_SQL_FILTER } from "@/lib/price-source-policy";
import {
  RANKED_PRICE_CACHE_AGE_SQL_FILTER,
  RANKED_PRICE_THROUGH_ONLY_SQL_FILTER,
  rankedPriceWindowSql,
} from "@/lib/ranked-price-cache-policy";
import { logServerError } from "@/lib/server-log";
import { filterCatalogStoresNearLocation } from "@/lib/store-catalog-sync";
import { isWeeklyAdChain } from "@/lib/weekly-ad-ingestion/weekly-ad-chain-registry";

export type MorningChainRegistryRow = {
  chainId: string;
  displayName: string;
  saleSource: boolean;
  sortOrder: number;
  priceMissReason?: string | null;
  shopperRanked?: boolean;
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
  /** Shopper-visible rows. When set, rows per store uses this instead of every fresh row. */
  visibleBySource?: readonly { sourceName: string; freshCount: number }[];
  /** Rows whose start is still in the future. */
  startingLaterBySource?: readonly { sourceName: string; freshCount: number }[];
  admittedStoreCounts?: ReadonlyMap<string, number>;
  catalogStoreCounts?: ReadonlyMap<string, number>;
}): MorningChainPriceFact[] {
  const freshOfficial = new Map<string, number>();
  const freshFlyer = new Map<string, number>();
  const visible = new Map<string, number>();
  const startingLater = new Map<string, number>();
  for (const row of input.freshBySource) {
    const parsed = priceSourceFreshnessKind(row.sourceName);
    if (!parsed) {
      continue;
    }
    const target = parsed.kind === "official" ? freshOfficial : freshFlyer;
    target.set(parsed.chainId, (target.get(parsed.chainId) ?? 0) + row.freshCount);
  }
  addSourceCounts(visible, input.visibleBySource ?? input.freshBySource);
  addSourceCounts(startingLater, input.startingLaterBySource ?? []);

  return [...input.registry]
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.displayName.localeCompare(right.displayName),
    )
    .map((row) => {
      const freshOfficialCount = freshOfficial.get(row.chainId) ?? 0;
      const freshFlyerCount = freshFlyer.get(row.chainId) ?? 0;
      const fact: MorningChainPriceFact = {
        displayName: row.displayName.trim(),
        chainId: row.chainId,
        admittedStore: input.admittedChainIds.has(row.chainId),
        saleSource: row.saleSource,
        freshOfficialCount,
        freshFlyerCount,
      };
      if (row.priceMissReason) {
        fact.priceMissReason = row.priceMissReason;
      }
      if (input.catalogStoreCounts) {
        fact.shopperRanked = row.shopperRanked === true;
        fact.catalogStoreCount = input.catalogStoreCounts.get(row.chainId) ?? 0;
      }
      const storeCount = input.admittedStoreCounts?.get(row.chainId) ?? 0;
      if (storeCount > 0) {
        fact.rowsPerStore = Math.round((visible.get(row.chainId) ?? 0) / storeCount);
        const laterPerStore = Math.round((startingLater.get(row.chainId) ?? 0) / storeCount);
        if (laterPerStore > 0) {
          fact.startingLaterPerStore = laterPerStore;
        }
      }
      return fact;
    });
}

function addSourceCounts(
  target: Map<string, number>,
  rows: readonly { sourceName: string; freshCount: number }[],
) {
  for (const row of rows) {
    const parsed = priceSourceFreshnessKind(row.sourceName);
    if (!parsed) {
      continue;
    }
    target.set(parsed.chainId, (target.get(parsed.chainId) ?? 0) + row.freshCount);
  }
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
    shopper_ranked: boolean;
  }>(
    `
      select chain_id, display_name, sale_discovery_strategy, sort_order, shopper_ranked
      from chain_registry
      order by sort_order asc, display_name asc
    `,
  );
  const freshness = await queryRankedPriceFreshness(pool);
  const shopperCounts = await loadShopperPriceCounts(pool);
  const admitted = await listAdmittedChains(input.activeZipCodes);
  const missReasons = await loadPriceMissReasons(pool);
  return assembleMorningChainPriceFacts({
    registry: registryResult.rows.map((row) => ({
      chainId: row.chain_id,
      displayName: row.display_name,
      saleSource: row.sale_discovery_strategy.trim().toLowerCase() !== "none",
      sortOrder: row.sort_order,
      shopperRanked: row.shopper_ranked === true,
      priceMissReason: missReasons.get(row.chain_id) ?? null,
    })),
    admittedChainIds: admitted.ids,
    admittedStoreCounts: admitted.storeCounts,
    catalogStoreCounts: admitted.catalogStoreCounts,
    freshBySource: freshness.bySource,
    visibleBySource: shopperCounts.visibleBySource,
    startingLaterBySource: shopperCounts.startingLaterBySource,
  });
}

/**
 * Rows a shopper read can return, and rows that start later.
 * The window fragment is the same one ranked reads use. A null start stays visible.
 */
async function loadShopperPriceCounts(pool: ReturnType<typeof getDbPool>): Promise<{
  visibleBySource: { sourceName: string; freshCount: number }[];
  startingLaterBySource: { sourceName: string; freshCount: number }[];
}> {
  const windowSql = await rankedPriceWindowSql(pool);
  const result = await pool.query<{
    source_name: string;
    visible_count: number;
    later_count: number;
  }>(
    `
      select
        source_name,
        count(*) filter (
          where ${windowSql}
            and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
        )::int as visible_count,
        count(*) filter (
          where valid_from > now()
            and ${RANKED_PRICE_THROUGH_ONLY_SQL_FILTER}
            and ${RANKED_PRICE_CACHE_AGE_SQL_FILTER}
        )::int as later_count
      from price_observations
      where in_stock = true
        and (${RANKED_PRICE_SOURCE_SQL_FILTER})
      group by source_name
    `,
  );
  return {
    visibleBySource: result.rows.map((row) => ({
      sourceName: row.source_name,
      freshCount: Number(row.visible_count),
    })),
    startingLaterBySource: result.rows.map((row) => ({
      sourceName: row.source_name,
      freshCount: Number(row.later_count),
    })),
  };
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
async function listAdmittedChains(
  activeZipCodes: readonly string[],
): Promise<{
  ids: Set<string>;
  storeCounts: Map<string, number>;
  catalogStoreCounts: Map<string, number>;
}> {
  const ids = new Set<string>();
  const storesByChain = new Map<string, Set<string>>();
  const catalogStoreCounts = new Map<string, number>();
  const stores = await loadCatalogStores();
  for (const store of stores) {
    const chain = inferStoreChainFromCatalog(store);
    if (!isWeeklyAdChain(chain)) {
      continue;
    }
    catalogStoreCounts.set(chain, (catalogStoreCounts.get(chain) ?? 0) + 1);
  }
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
      if (!isWeeklyAdChain(chain)) {
        continue;
      }
      ids.add(chain);
      const seen = storesByChain.get(chain) ?? new Set<string>();
      seen.add(store.id);
      storesByChain.set(chain, seen);
    }
  }
  const storeCounts = new Map<string, number>();
  for (const [chain, seen] of storesByChain) {
    storeCounts.set(chain, seen.size);
  }
  return { ids, storeCounts, catalogStoreCounts };
}

export function logMorningChainPriceFailure(error: unknown) {
  logServerError("morning-report.chain-prices", error);
}
