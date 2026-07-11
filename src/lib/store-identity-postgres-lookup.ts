/**
 * Option A Slice 5a — Postgres-backed StoreIdentityLookup for server paths.
 *
 * Loads confirmed aliases only (provisional/rejected stay out of expand).
 * Unlinked store ids resolve via read-time virtual singleton (Slice 1 contract).
 */

import type { Pool } from "pg";
import { getDbPool } from "@/lib/db";
import { logServerError } from "@/lib/server-log";
import {
  createMemoryStoreIdentityLookup,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";
import type {
  StoreIdentityAliasRecord,
  StoreIdentityMemberRole,
  StoreIdentityRecord,
} from "@/lib/store-identity-types";

type IdentityRow = {
  id: string;
  canonical_store_id: string;
  display_name: string | null;
  kind: string | null;
  city: string | null;
  state: string | null;
  latitude: string | null;
  longitude: string | null;
  display_source_name: string | null;
  last_resolved_at: Date | null;
};

type AliasRow = {
  identity_id: string;
  source_system: string;
  external_id: string;
  store_id: string | null;
  snap_retailer_id: string | null;
  member_role: StoreIdentityMemberRole;
  link_status: string;
  match_method: string | null;
  match_confidence: string | null;
  linked_at: Date | null;
  notes: string | null;
};

function mapIdentityRow(row: IdentityRow): StoreIdentityRecord {
  return {
    id: row.id,
    canonicalStoreId: row.canonical_store_id,
    displayName: row.display_name,
    kind: row.kind,
    city: row.city,
    state: row.state,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    displaySourceName: row.display_source_name,
    lastResolvedAt: row.last_resolved_at?.toISOString() ?? null,
    isVirtualSingleton: false,
  };
}

function mapAliasRow(row: AliasRow): StoreIdentityAliasRecord {
  return {
    identityId: row.identity_id,
    sourceSystem: row.source_system,
    externalId: row.external_id,
    storeId: row.store_id,
    snapRetailerId: row.snap_retailer_id,
    memberRole: row.member_role,
    linkStatus: "confirmed",
    matchMethod: row.match_method,
    matchConfidence:
      row.match_confidence === null ? null : Number(row.match_confidence),
    linkedAt: row.linked_at?.toISOString() ?? null,
    notes: row.notes,
  };
}

/**
 * Load confirmed identity graph from Postgres into an in-memory lookup.
 * Seeds 022/023 become visible here for the first time on live server paths.
 */
export async function createPostgresStoreIdentityLookup(
  pool: Pool = getDbPool(),
): Promise<StoreIdentityLookup> {
  const identitiesResult = await pool.query<IdentityRow>(`
    select
      id,
      canonical_store_id,
      display_name,
      kind,
      city,
      state,
      latitude,
      longitude,
      display_source_name,
      last_resolved_at
    from store_identities
  `);

  const aliasesResult = await pool.query<AliasRow>(`
    select
      identity_id,
      source_system,
      external_id,
      store_id,
      snap_retailer_id,
      member_role,
      link_status,
      match_method,
      match_confidence,
      linked_at,
      notes
    from store_identity_aliases
    where link_status = 'confirmed'
  `);

  const identities = identitiesResult.rows.map(mapIdentityRow);
  const aliases = aliasesResult.rows.map(mapAliasRow);

  return createMemoryStoreIdentityLookup({
    identities,
    aliases,
  });
}

/**
 * Prefer Postgres when expand is needed; fall back to empty virtual-singleton
 * lookup so market-search never fails closed on identity table errors.
 */
export async function createPostgresStoreIdentityLookupSafe(
  pool?: Pool,
): Promise<StoreIdentityLookup> {
  try {
    return await createPostgresStoreIdentityLookup(pool ?? getDbPool());
  } catch (error) {
    logServerError("store-identity-postgres-lookup", error);
    const { createDefaultStoreIdentityLookup } = await import(
      "@/lib/store-identity-resolvers"
    );
    return createDefaultStoreIdentityLookup();
  }
}
