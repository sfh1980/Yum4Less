/**
 * Slice D ingest writes — provisional OSM↔official aliases only.
 * Never sets link_status=confirmed (AUTO_CONFIRM stays off).
 */

import type { Pool } from "pg";
import { getDbPool } from "@/lib/db";
import { listCatalogStoresNearLocation } from "@/lib/market-catalog-repository";
import { INGEST_ZCTA_SAFETY_CAP_MILES } from "@/lib/market-density";
import { OSM_MAP_CATALOG_SOURCE, OSM_MAP_FIXTURE_SOURCE } from "@/lib/osm-food-retail-discovery";
import { logServerError } from "@/lib/server-log";
import {
  emptyAliasWriteStats,
  ensureStoreSelfAlias,
  isAbsorbableSelfAliasSingleton,
  mergeAliasWriteStats,
  type StoreIdentityAliasWriteStats,
} from "@/lib/store-identity-ingest-aliases";
import {
  proposeStoreIdentityProximityMatches,
  type StoreIdentityProximityPair,
} from "@/lib/store-identity-proximity-matcher";

export type StoreIdentityProximityReviewRow = {
  osmId: string;
  osmName: string;
  officialId: string;
  officialName: string;
  chainId: string;
  miles: number;
  confidence: number;
};

export type StoreIdentityProximityRunResult = {
  considered: number;
  writeCandidates: number;
  reviewCandidates: number;
  aliasesEnsured: number;
  aliasesSkipped: number;
  aliasConflicts: number;
  applied: boolean;
  write: StoreIdentityProximityReviewRow[];
  review: StoreIdentityProximityReviewRow[];
};

type AliasRow = {
  identity_id: string;
  source_system: string;
  external_id: string;
  store_id: string | null;
  member_role: string;
  link_status: string;
  match_method: string | null;
};

function toReviewRow(pair: StoreIdentityProximityPair): StoreIdentityProximityReviewRow {
  return {
    osmId: pair.osm.id,
    osmName: pair.osm.name,
    officialId: pair.official.id,
    officialName: pair.official.name,
    chainId: pair.chainId,
    miles: pair.score.miles,
    confidence: pair.score.confidence,
  };
}

async function fetchAliasByStoreId(pool: Pool, storeId: string): Promise<AliasRow | null> {
  const result = await pool.query<AliasRow>(
    `
      select identity_id, source_system, external_id, store_id,
             member_role, link_status, match_method
      from store_identity_aliases
      where store_id = $1
      limit 1
    `,
    [storeId],
  );
  return result.rows[0] ?? null;
}

async function countAliasesForIdentity(pool: Pool, identityId: string): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `select count(*)::text as n from store_identity_aliases where identity_id = $1`,
    [identityId],
  );
  return Number(result.rows[0]?.n ?? 0);
}

function osmSourceSystem(sourceName: string | undefined): string {
  return sourceName === OSM_MAP_FIXTURE_SOURCE
    ? OSM_MAP_FIXTURE_SOURCE
    : OSM_MAP_CATALOG_SOURCE;
}

export async function ensureProximityCrossLink(
  pair: StoreIdentityProximityPair,
  pool: Pool = getDbPool(),
): Promise<StoreIdentityAliasWriteStats> {
  const stats = emptyAliasWriteStats();
  const official = pair.official;
  const osm = pair.osm;

  try {
    const officialStats = await ensureStoreSelfAlias(
      {
        storeId: official.id,
        sourceName: official.sourceName ?? "kroger-official-api",
        sourceStoreId: official.sourceStoreId,
        name: official.name,
        kind: official.kind,
        city: official.city,
        state: official.state,
        latitude: official.latitude,
        longitude: official.longitude,
      },
      pool,
    );
    Object.assign(stats, mergeAliasWriteStats(stats, officialStats));

    const officialAlias = await fetchAliasByStoreId(pool, official.id);
    if (!officialAlias) {
      stats.aliasConflicts += 1;
      return stats;
    }

    const identityId = officialAlias.identity_id;
    const osmAlias = await fetchAliasByStoreId(pool, osm.id);
    if (osmAlias && osmAlias.identity_id === identityId) {
      stats.aliasesSkipped += 1;
      return stats;
    }

    if (osmAlias && osmAlias.identity_id !== identityId) {
      const memberCount = await countAliasesForIdentity(pool, osmAlias.identity_id);
      if (
        !isAbsorbableSelfAliasSingleton({
          storeId: osm.id,
          alias: osmAlias,
          memberCount,
        })
      ) {
        stats.aliasConflicts += 1;
        logServerError(
          "store-identity.proximity-conflict",
          new Error("OSM already linked to a different identity"),
          {
            osmId: osm.id,
            officialId: official.id,
            existingIdentityId: osmAlias.identity_id,
          },
        );
        return stats;
      }
      await pool.query(`delete from store_identities where id = $1`, [osmAlias.identity_id]);
    }

    const osmSystem = osmSourceSystem(osm.sourceName);
    await pool.query(
      `
        insert into store_identity_aliases (
          identity_id, source_system, external_id, store_id,
          member_role, link_status, match_method, match_confidence, notes
        )
        values (
          $1, $2, $3, $4, 'alias', 'provisional', 'proximity', $5,
          'Slice D OSM↔official proximity match; AUTO_CONFIRM off'
        )
        on conflict (source_system, external_id) do nothing
      `,
      [identityId, osmSystem, osm.id, osm.id, pair.score.confidence],
    );

    const linked = await fetchAliasByStoreId(pool, osm.id);
    if (!linked || linked.identity_id !== identityId) {
      stats.aliasConflicts += 1;
      return stats;
    }
    stats.aliasesEnsured += 1;
    return stats;
  } catch (error) {
    stats.aliasConflicts += 1;
    logServerError("store-identity.proximity-write-failed", error, {
      osmId: osm.id,
      officialId: official.id,
    });
    return stats;
  }
}

export async function runStoreIdentityProximityMatcherNearLocation(input: {
  latitude: number;
  longitude: number;
  apply: boolean;
  radiusMiles?: number;
  pool?: Pool;
}): Promise<StoreIdentityProximityRunResult> {
  const pool = input.pool ?? getDbPool();
  const stores = await listCatalogStoresNearLocation({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMiles: input.radiusMiles ?? INGEST_ZCTA_SAFETY_CAP_MILES,
  });
  const proposal = proposeStoreIdentityProximityMatches(stores);
  const stats = emptyAliasWriteStats();

  if (input.apply) {
    for (const pair of proposal.write) {
      const written = await ensureProximityCrossLink(pair, pool);
      Object.assign(stats, mergeAliasWriteStats(stats, written));
    }
  }

  return {
    considered: stores.length,
    writeCandidates: proposal.write.length,
    reviewCandidates: proposal.review.length,
    aliasesEnsured: stats.aliasesEnsured,
    aliasesSkipped: stats.aliasesSkipped,
    aliasConflicts: stats.aliasConflicts,
    applied: input.apply,
    write: proposal.write.map(toReviewRow),
    review: proposal.review.map(toReviewRow),
  };
}
