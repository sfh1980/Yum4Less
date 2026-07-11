/**
 * Option A Slice 5c — ingest-time store identity alias writes.
 *
 * Self-alias on catalog upsert/refresh + allowlisted Aldi→OSM explicit-pointer
 * cross-links only. No proximity/name matcher (Slice D). AUTO_CONFIRM stays OFF;
 * pointer confirm is a deterministic allowlisted path, not scored promotion.
 */

import type { Pool } from "pg";
import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import { OSM_MAP_CATALOG_SOURCE, OSM_MAP_FIXTURE_SOURCE } from "@/lib/osm-food-retail-discovery";

export type StoreIdentityAliasWriteStats = {
  aliasesEnsured: number;
  aliasesSkipped: number;
  aliasConflicts: number;
};

export function emptyAliasWriteStats(): StoreIdentityAliasWriteStats {
  return { aliasesEnsured: 0, aliasesSkipped: 0, aliasConflicts: 0 };
}

export function mergeAliasWriteStats(
  ...parts: StoreIdentityAliasWriteStats[]
): StoreIdentityAliasWriteStats {
  return parts.reduce(
    (acc, part) => ({
      aliasesEnsured: acc.aliasesEnsured + part.aliasesEnsured,
      aliasesSkipped: acc.aliasesSkipped + part.aliasesSkipped,
      aliasConflicts: acc.aliasConflicts + part.aliasConflicts,
    }),
    emptyAliasWriteStats(),
  );
}

/** Aldi catalog / weekly-ad sources allowed to create OSM pointer cross-links. */
export const ALDI_POINTER_ALLOWLISTED_SOURCES = new Set<string>([
  "yum4less-market-catalog",
  "aldi-weekly-ad-scrape",
]);

const KROGER_OFFICIAL_API_SOURCE = "kroger-official-api";

const OSM_POINTER_ID_RE = /^(?:fixture-)?osm-(?:node|way)-\d+$/;

export function isAllowlistedAldiPointerCatalogSource(
  sourceName: string | null | undefined,
): boolean {
  if (!sourceName) {
    return false;
  }
  return ALDI_POINTER_ALLOWLISTED_SOURCES.has(sourceName);
}

/** True when source_store_id is an OSM (or fixture-OSM) catalog store id. */
export function isOsmStorePointerTargetId(
  sourceStoreId: string | null | undefined,
): boolean {
  if (!sourceStoreId) {
    return false;
  }
  return OSM_POINTER_ID_RE.test(sourceStoreId.trim());
}

export function resolveSelfAliasKeys(input: {
  storeId: string;
  sourceName: string;
  sourceStoreId?: string | null;
}): { sourceSystem: string; externalId: string } {
  const sourceSystem = input.sourceName.trim();
  const providerId = input.sourceStoreId?.trim() ?? "";

  // Mirror seed 022: Kroger official API aliases use provider id, not store id.
  if (sourceSystem === KROGER_OFFICIAL_API_SOURCE && providerId.length > 0) {
    return { sourceSystem, externalId: providerId };
  }

  return { sourceSystem, externalId: input.storeId };
}

type AliasRow = {
  identity_id: string;
  source_system: string;
  external_id: string;
  store_id: string | null;
  member_role: string;
  link_status: string;
  match_method: string | null;
};

function logIngestAliasConflict(context: Record<string, string | number | boolean | undefined>) {
  logServerError(
    "store-identity.ingest-alias-conflict",
    new Error("Conflicting store identity alias binding; existing row left untouched"),
    context,
  );
}

function logIngestAliasSummary(stats: StoreIdentityAliasWriteStats, context?: Record<string, string>) {
  if (
    stats.aliasesEnsured === 0 &&
    stats.aliasesSkipped === 0 &&
    stats.aliasConflicts === 0
  ) {
    return;
  }

  console.log(
    JSON.stringify({
      level: "info",
      scope: "store-identity.ingest-alias-summary",
      ...stats,
      ...context,
      at: new Date().toISOString(),
    }),
  );
}

async function fetchAliasByStoreId(
  pool: Pool,
  storeId: string,
): Promise<AliasRow | null> {
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

async function fetchAliasBySourceExternal(
  pool: Pool,
  sourceSystem: string,
  externalId: string,
): Promise<AliasRow | null> {
  const result = await pool.query<AliasRow>(
    `
      select identity_id, source_system, external_id, store_id,
             member_role, link_status, match_method
      from store_identity_aliases
      where source_system = $1 and external_id = $2
      limit 1
    `,
    [sourceSystem, externalId],
  );
  return result.rows[0] ?? null;
}

async function countAliasesForIdentity(
  pool: Pool,
  identityId: string,
): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `select count(*)::text as n from store_identity_aliases where identity_id = $1`,
    [identityId],
  );
  return Number(result.rows[0]?.n ?? 0);
}

/**
 * True when an OSM (or other) singleton is safe to absorb into a pointer
 * cross-link: identity id equals store id, single self-alias member only.
 */
export function isAbsorbableSelfAliasSingleton(input: {
  storeId: string;
  alias: Pick<AliasRow, "identity_id" | "match_method">;
  memberCount: number;
}): boolean {
  return (
    input.alias.identity_id === input.storeId &&
    input.memberCount === 1 &&
    input.alias.match_method === "self"
  );
}

export type CatalogIdentityAliasInput = {
  storeId: string;
  sourceName: string;
  sourceStoreId?: string | null;
  name?: string | null;
  kind?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Ensure this store has a confirmed self-alias for its own source_system/external_id.
 * Does not cross-link to any other store.
 */
export async function ensureStoreSelfAlias(
  input: CatalogIdentityAliasInput,
  pool: Pool = getDbPool(),
): Promise<StoreIdentityAliasWriteStats> {
  const stats = emptyAliasWriteStats();
  const sourceName = input.sourceName?.trim();
  if (!sourceName) {
    stats.aliasesSkipped += 1;
    return stats;
  }

  const { sourceSystem, externalId } = resolveSelfAliasKeys({
    storeId: input.storeId,
    sourceName,
    sourceStoreId: input.sourceStoreId,
  });

  try {
    const byStore = await fetchAliasByStoreId(pool, input.storeId);
    if (byStore) {
      if (
        byStore.source_system === sourceSystem &&
        byStore.external_id === externalId
      ) {
        stats.aliasesSkipped += 1;
        return stats;
      }
      // Store already attached under a different key (e.g. seed 022 slug alias).
      // Do not create a second binding or overwrite.
      stats.aliasesSkipped += 1;
      return stats;
    }

    const byKeys = await fetchAliasBySourceExternal(pool, sourceSystem, externalId);
    if (byKeys) {
      if (byKeys.store_id === input.storeId) {
        stats.aliasesSkipped += 1;
        return stats;
      }
      stats.aliasConflicts += 1;
      logIngestAliasConflict({
        reason: "source_external_bound_to_other_store",
        sourceSystem,
        externalId,
        attemptedStoreId: input.storeId,
        existingStoreId: byKeys.store_id ?? undefined,
        existingIdentityId: byKeys.identity_id,
      });
      return stats;
    }

    await pool.query(
      `
        insert into store_identities (
          id, canonical_store_id, display_name, kind, city, state,
          latitude, longitude, display_source_name, last_resolved_at
        )
        values ($1, $1, $2, $3, $4, $5, $6, $7, $8, now())
        on conflict (id) do nothing
      `,
      [
        input.storeId,
        input.name ?? null,
        input.kind ?? null,
        input.city ?? null,
        input.state ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        sourceName,
      ],
    );

    // Identity may already exist as canonical for a multi-member seed; only
    // insert self-alias when this store is that identity's canonical and has
    // no store_id row yet (handled above). If identity exists but this store
    // is not its canonical and has no alias, creating a second identity with
    // id=storeId is fine for unlinked stores only — if insert conflicted
    // because id is taken as someone else's identity, skip carefully.
    const identityExists = await pool.query<{ id: string }>(
      `select id from store_identities where id = $1`,
      [input.storeId],
    );
    if ((identityExists.rowCount ?? 0) === 0) {
      // Canonical id collision under a different check — treat as skip.
      stats.aliasesSkipped += 1;
      return stats;
    }

    await pool.query(
      `
        insert into store_identity_aliases (
          identity_id, source_system, external_id, store_id,
          member_role, link_status, match_method, match_confidence, notes
        )
        values ($1, $2, $3, $4, 'canonical', 'confirmed', 'self', 1.0, $5)
      `,
      [
        input.storeId,
        sourceSystem,
        externalId,
        input.storeId,
        "Option A Slice 5c ingest self-alias",
      ],
    );

    stats.aliasesEnsured += 1;
    return stats;
  } catch (error) {
    stats.aliasConflicts += 1;
    logServerError("store-identity.ingest-alias-conflict", error, {
      reason: "self_alias_write_failed",
      storeId: input.storeId,
      sourceSystem,
      externalId,
    });
    return stats;
  }
}

/**
 * Allowlisted Aldi→OSM explicit-pointer cross-link when source_store_id equals
 * an existing OSM store id. match_confidence = 1.0 (exact id match).
 *
 * Seed 023 used fixture-scorer 0.985 (pointer + name + type); live ingest here
 * is an exact source_store_id match, not a scored estimate — see seed notes.
 */
export async function ensureAllowlistedPointerCrossLink(
  input: CatalogIdentityAliasInput,
  pool: Pool = getDbPool(),
): Promise<StoreIdentityAliasWriteStats> {
  const stats = emptyAliasWriteStats();

  if (!isAllowlistedAldiPointerCatalogSource(input.sourceName)) {
    stats.aliasesSkipped += 1;
    return stats;
  }

  const osmId = input.sourceStoreId?.trim() ?? "";
  if (!osmId) {
    stats.aliasesSkipped += 1;
    return stats;
  }

  if (!isOsmStorePointerTargetId(osmId)) {
    // Unreliable / non-OSM pointer — do not invent a cross-link.
    stats.aliasesSkipped += 1;
    return stats;
  }

  if (osmId === input.storeId) {
    stats.aliasesSkipped += 1;
    return stats;
  }

  try {
    const osmStore = await pool.query<{ id: string; source_name: string | null }>(
      `select id, source_name from stores where id = $1`,
      [osmId],
    );
    if ((osmStore.rowCount ?? 0) === 0) {
      stats.aliasesSkipped += 1;
      return stats;
    }

    const osmSourceName = osmStore.rows[0]?.source_name ?? OSM_MAP_CATALOG_SOURCE;
    const osmSourceSystem =
      osmSourceName === OSM_MAP_FIXTURE_SOURCE
        ? OSM_MAP_FIXTURE_SOURCE
        : OSM_MAP_CATALOG_SOURCE;

    const catalogAlias = await fetchAliasByStoreId(pool, input.storeId);
    const osmAlias = await fetchAliasByStoreId(pool, osmId);
    const osmByKeys = await fetchAliasBySourceExternal(
      pool,
      osmSourceSystem,
      osmId,
    );

    if (
      catalogAlias &&
      osmAlias &&
      catalogAlias.identity_id === osmAlias.identity_id
    ) {
      stats.aliasesSkipped += 1;
      return stats;
    }

    if (
      osmByKeys &&
      osmByKeys.store_id &&
      osmByKeys.store_id !== osmId
    ) {
      stats.aliasConflicts += 1;
      logIngestAliasConflict({
        reason: "osm_source_external_bound_elsewhere",
        sourceSystem: osmSourceSystem,
        externalId: osmId,
        attemptedStoreId: osmId,
        existingStoreId: osmByKeys.store_id,
        existingIdentityId: osmByKeys.identity_id,
        catalogStoreId: input.storeId,
      });
      return stats;
    }

    // Ensure catalog is a persisted identity member first.
    if (!catalogAlias) {
      accumulateAliasWriteStats(stats, await ensureStoreSelfAlias(input, pool));
    }

    const catalogMembership =
      catalogAlias ?? (await fetchAliasByStoreId(pool, input.storeId));
    if (!catalogMembership) {
      stats.aliasConflicts += 1;
      logIngestAliasConflict({
        reason: "catalog_self_alias_missing_after_ensure",
        catalogStoreId: input.storeId,
        osmId,
      });
      return stats;
    }

    const identityId = catalogMembership.identity_id;

    if (osmAlias && osmAlias.identity_id !== identityId) {
      const memberCount = await countAliasesForIdentity(pool, osmAlias.identity_id);
      if (
        !isAbsorbableSelfAliasSingleton({
          storeId: osmId,
          alias: osmAlias,
          memberCount,
        })
      ) {
        stats.aliasConflicts += 1;
        logIngestAliasConflict({
          reason: "osm_already_linked_differently",
          osmId,
          existingIdentityId: osmAlias.identity_id,
          attemptedIdentityId: identityId,
          catalogStoreId: input.storeId,
          matchMethod: osmAlias.match_method ?? undefined,
          memberCount,
        });
        return stats;
      }

      await pool.query(`delete from store_identities where id = $1`, [
        osmAlias.identity_id,
      ]);
    } else if (osmByKeys && osmByKeys.identity_id !== identityId) {
      stats.aliasConflicts += 1;
      logIngestAliasConflict({
        reason: "osm_keys_on_other_identity",
        osmId,
        existingIdentityId: osmByKeys.identity_id,
        attemptedIdentityId: identityId,
        catalogStoreId: input.storeId,
      });
      return stats;
    }

    const stillLinked = await fetchAliasByStoreId(pool, osmId);
    if (stillLinked && stillLinked.identity_id === identityId) {
      stats.aliasesSkipped += 1;
      return stats;
    }

    await pool.query(
      `
        insert into store_identity_aliases (
          identity_id, source_system, external_id, store_id,
          member_role, link_status, match_method, match_confidence, notes
        )
        values (
          $1, $2, $3, $4, 'alias', 'confirmed', 'pointer', 1.0,
          $5
        )
        on conflict (source_system, external_id) do nothing
      `,
      [
        identityId,
        osmSourceSystem,
        osmId,
        osmId,
        // Seed 023 fixture-scorer confidence was 0.985; live ingest uses 1.0
        // because source_store_id is an exact id match, not a scored estimate.
        "Option A Slice 5c ingest pointer cross-link (exact source_store_id; seed 023 used fixture 0.985)",
      ],
    );

    const linked = await fetchAliasByStoreId(pool, osmId);
    if (!linked || linked.identity_id !== identityId) {
      // ON CONFLICT DO NOTHING hit an unexpected row — treat as conflict.
      stats.aliasConflicts += 1;
      logIngestAliasConflict({
        reason: "pointer_insert_did_not_attach",
        osmId,
        catalogStoreId: input.storeId,
        attemptedIdentityId: identityId,
      });
      return stats;
    }

    stats.aliasesEnsured += 1;
    return stats;
  } catch (error) {
    stats.aliasConflicts += 1;
    logServerError("store-identity.ingest-alias-conflict", error, {
      reason: "pointer_cross_link_failed",
      catalogStoreId: input.storeId,
      sourceStoreId: input.sourceStoreId ?? undefined,
    });
    return stats;
  }
}

/**
 * After a successful catalog store write/refresh: self-alias, then allowlisted
 * Aldi pointer cross-link when applicable.
 */
export async function ensureCatalogStoreIdentityAliases(
  input: CatalogIdentityAliasInput,
  pool: Pool = getDbPool(),
  options?: { logSummary?: boolean; summaryContext?: Record<string, string> },
): Promise<StoreIdentityAliasWriteStats> {
  const selfStats = await ensureStoreSelfAlias(input, pool);
  const pointerStats = await ensureAllowlistedPointerCrossLink(input, pool);
  const stats = mergeAliasWriteStats(selfStats, pointerStats);

  if (options?.logSummary !== false) {
    logIngestAliasSummary(stats, options?.summaryContext);
  }

  return stats;
}

export function accumulateAliasWriteStats(
  target: StoreIdentityAliasWriteStats,
  part: StoreIdentityAliasWriteStats,
): void {
  target.aliasesEnsured += part.aliasesEnsured;
  target.aliasesSkipped += part.aliasesSkipped;
  target.aliasConflicts += part.aliasConflicts;
}

/**
 * Drop alias + identity rows that RESTRICT deleting a stores row.
 * Used before intentional store retirement/merge deletes.
 */
export async function deleteStoreIdentityAttachmentsForStore(
  storeId: string,
  pool: Pool = getDbPool(),
): Promise<void> {
  await pool.query(`delete from store_identity_aliases where store_id = $1`, [
    storeId,
  ]);
  await pool.query(
    `delete from store_identities where id = $1 or canonical_store_id = $1`,
    [storeId],
  );
}
