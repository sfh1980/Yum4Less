import { getDbPool } from "@/lib/db";
import { RANKED_PRICE_CACHE_TTL_HOURS } from "@/lib/ranked-price-cache-policy";
import {
  buildStoreCoverageRow,
  filterStoreCoverageRows,
  summarizeStoreCoverage,
  type ChainRegistryRow,
  type ChainRolloutStage,
  type StoreCoverageRow,
  type StoreCoverageSourceRow,
  type StoreCoverageSummary,
  type StoreCoverageUsableFilter,
} from "@/lib/owner/store-coverage";

export const STORE_COVERAGE_LIMITS = {
  default: 50,
  max: 100,
} as const;

type ChainRegistryDbRow = {
  chain_id: string;
  display_name: string;
  rollout_stage: ChainRolloutStage;
  shopper_ranked: boolean;
  settings_selectable: boolean;
  weekly_ad_eligible: boolean;
  promotion_blocked: boolean;
  flipp_merchant_name: string | null;
  primary_store_id_prefixes: string[] | null;
  name_match_fragments: string[] | null;
  location_strategy: string;
  sale_discovery_strategy: string;
  official_pricing_adapter: string | null;
  weekly_ad_adapter: string | null;
  sort_order: number;
  notes: string | null;
};

type StoreCoverageDbRow = {
  store_id: string;
  name: string;
  kind: string;
  city: string;
  state: string;
  latitude: string | number | null;
  longitude: string | number | null;
  source_name: string | null;
  source_store_id: string | null;
  seen: boolean;
  mapped: boolean;
  fresh_sale_count: string | number;
  last_sale_at: Date | string | null;
};

function parseCoordinate(value: string | number | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asIso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapRegistryRow(row: ChainRegistryDbRow): ChainRegistryRow {
  return {
    chainId: row.chain_id,
    displayName: row.display_name,
    rolloutStage: row.rollout_stage,
    shopperRanked: row.shopper_ranked,
    settingsSelectable: row.settings_selectable,
    weeklyAdEligible: row.weekly_ad_eligible,
    promotionBlocked: row.promotion_blocked,
    flippMerchantName: row.flipp_merchant_name,
    primaryStoreIdPrefixes: row.primary_store_id_prefixes ?? [],
    nameMatchFragments: row.name_match_fragments ?? [],
    locationStrategy: row.location_strategy,
    saleDiscoveryStrategy: row.sale_discovery_strategy,
    officialPricingAdapter: row.official_pricing_adapter,
    weeklyAdAdapter: row.weekly_ad_adapter,
    sortOrder: row.sort_order,
    notes: row.notes,
  };
}

function mapSourceRow(row: StoreCoverageDbRow): StoreCoverageSourceRow {
  return {
    storeId: row.store_id,
    name: row.name,
    kind: row.kind,
    city: row.city,
    state: row.state,
    latitude: parseCoordinate(row.latitude),
    longitude: parseCoordinate(row.longitude),
    sourceName: row.source_name,
    sourceStoreId: row.source_store_id,
    seen: row.seen,
    mapped: row.mapped,
    freshSaleCount: Number(row.fresh_sale_count) || 0,
    lastSaleAt: asIso(row.last_sale_at),
  };
}

export async function listChainRegistry(): Promise<ChainRegistryRow[]> {
  const result = await getDbPool().query<ChainRegistryDbRow>(
    `
      select
        chain_id,
        display_name,
        rollout_stage,
        shopper_ranked,
        settings_selectable,
        weekly_ad_eligible,
        promotion_blocked,
        flipp_merchant_name,
        primary_store_id_prefixes,
        name_match_fragments,
        location_strategy,
        sale_discovery_strategy,
        official_pricing_adapter,
        weekly_ad_adapter,
        sort_order,
        notes
      from chain_registry
      order by sort_order asc, display_name asc
    `,
  );
  return result.rows.map(mapRegistryRow);
}

export async function listStoreCoverage(input: {
  nameQuery?: string;
  locationQuery?: string;
  usable?: StoreCoverageUsableFilter;
  limit: number;
  offset: number;
}): Promise<{
  stores: StoreCoverageRow[];
  summaries: StoreCoverageSummary[];
  freshnessHours: number;
  hasMore: boolean;
  total: number;
}> {
  const [registry, coverageResult] = await Promise.all([
    listChainRegistry(),
    getDbPool().query<StoreCoverageDbRow>(
      `
        select
          store_id,
          name,
          kind,
          city,
          state,
          latitude,
          longitude,
          source_name,
          source_store_id,
          seen,
          mapped,
          fresh_sale_count,
          last_sale_at
        from store_coverage
        order by name asc, store_id asc
      `,
    ),
  ]);

  const allRows = coverageResult.rows
    .map(mapSourceRow)
    .map((store) => buildStoreCoverageRow(store, registry));
  const filtered = filterStoreCoverageRows(allRows, {
    nameQuery: input.nameQuery,
    locationQuery: input.locationQuery,
    usable: input.usable,
  });
  const stores = filtered.slice(input.offset, input.offset + input.limit);

  return {
    stores,
    summaries: summarizeStoreCoverage(allRows, registry),
    freshnessHours: RANKED_PRICE_CACHE_TTL_HOURS,
    hasMore: input.offset + stores.length < filtered.length,
    total: filtered.length,
  };
}
