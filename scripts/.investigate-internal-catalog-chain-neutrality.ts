/**
 * Phase 2a: per-chain price_observations coverage for INTERNAL_CATALOG (97 items).
 * Run: npx tsx scripts/.investigate-internal-catalog-chain-neutrality.ts
 */
import { loadEnvLocal } from "@/lib/load-env-local";

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
}

import { getDbPool } from "@/lib/db";
import {
  inferStoreChainFromCatalog,
  type CatalogStoreChainInput,
} from "@/lib/chain-rollout-policy";
import { INTERNAL_CATALOG_INGREDIENT_IDS } from "@/lib/internal-catalog";
import type { StoreChain } from "@/lib/provider-rollout";

const TARGET_CHAINS: StoreChain[] = [
  "kroger",
  "aldi",
  "publix",
  "food-lion",
  "walmart",
];

/** Match idx_price_observations_current_ranked: ranked official + weekly-ad rows. */
const RECENT_OBSERVATIONS_SQL = `
  select distinct
    po.ingredient_id,
    s.id as store_id,
    s.name as store_name,
    s.source_name,
    po.in_stock,
    coalesce(po.last_verified_at, po.observed_at) as verified_at,
    po.source_kind
  from price_observations po
  join stores s on s.id = po.store_id
  where po.ingredient_id = any($1::text[])
    and po.in_stock = true
    and po.source_kind in ('official-online', 'weekly-ad')
    and coalesce(po.last_verified_at, po.observed_at) >= now() - interval '90 days'
`;

function resolveChain(store: CatalogStoreChainInput): StoreChain {
  return inferStoreChainFromCatalog(store);
}

async function main() {
  const pool = getDbPool();
  const trackedIds = [...INTERNAL_CATALOG_INGREDIENT_IDS];
  const total = trackedIds.length;

  const obsResult = await pool.query<{
    ingredient_id: string;
    store_id: string;
    store_name: string;
    source_name: string | null;
    in_stock: boolean;
    verified_at: Date;
    source_kind: string | null;
  }>(RECENT_OBSERVATIONS_SQL, [trackedIds]);

  const matchedByChain = new Map<StoreChain, Set<string>>();
  for (const chain of TARGET_CHAINS) {
    matchedByChain.set(chain, new Set());
  }

  const unmatchedStoreSamples: Array<{
    storeId: string;
    storeName: string;
    sourceName: string | null;
    chain: StoreChain;
  }> = [];

  for (const row of obsResult.rows) {
    const chain = resolveChain({
      id: row.store_id,
      name: row.store_name,
      source_name: row.source_name,
    });

    if (TARGET_CHAINS.includes(chain as (typeof TARGET_CHAINS)[number])) {
      matchedByChain.get(chain)?.add(row.ingredient_id);
    } else if (chain === "unknown" && unmatchedStoreSamples.length < 10) {
      unmatchedStoreSamples.push({
        storeId: row.store_id,
        storeName: row.store_name,
        sourceName: row.source_name,
        chain,
      });
    }
  }

  const unionMatched = new Set<string>();
  for (const ids of matchedByChain.values()) {
    for (const id of ids) {
      unionMatched.add(id);
    }
  }

  const perChainReport = TARGET_CHAINS.map((chain) => {
    const matched = matchedByChain.get(chain)?.size ?? 0;
    const pct = ((matched / total) * 100).toFixed(1);
    const missing = trackedIds.filter((id) => !matchedByChain.get(chain)?.has(id));
    return {
      chain,
      matched,
      total,
      pct: `${pct}%`,
      missingCount: missing.length,
      missingSample: missing.slice(0, 8),
    };
  });

  const ingredientChainCounts = trackedIds.map((id) => {
    const chainsWithPrice = TARGET_CHAINS.filter((chain) =>
      matchedByChain.get(chain)?.has(id),
    );
    return {
      ingredientId: id,
      chainCount: chainsWithPrice.length,
      chains: chainsWithPrice,
    };
  });

  const krogerOnly = ingredientChainCounts.filter(
    (row) => row.chainCount === 1 && row.chains[0] === "kroger",
  );
  const zeroCoverage = ingredientChainCounts.filter((row) => row.chainCount === 0);
  const allFive = ingredientChainCounts.filter((row) => row.chainCount === 5);

  console.log(
    JSON.stringify(
      {
        phase: "2a-chain-neutrality",
        db: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"),
        criteria: {
          inStock: true,
          sourceKind: ["official-online", "weekly-ad"],
          recencyDays: 90,
          trackedIngredientCount: total,
        },
        observationRowCount: obsResult.rows.length,
        perChainCoverage: perChainReport,
        unionCoverage: {
          matched: unionMatched.size,
          total,
          pct: `${((unionMatched.size / total) * 100).toFixed(1)}%`,
        },
        skewSignals: {
          krogerOnlyIngredientCount: krogerOnly.length,
          krogerOnlySample: krogerOnly.slice(0, 10).map((row) => row.ingredientId),
          zeroCoverageCount: zeroCoverage.length,
          zeroCoverageSample: zeroCoverage.slice(0, 10).map((row) => row.ingredientId),
          allFiveChainsCount: allFive.length,
        },
        unmatchedStoreSamples,
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
