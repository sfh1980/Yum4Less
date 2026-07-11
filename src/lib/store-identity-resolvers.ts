/**
 * Option A Slice 1 — identity resolvers (alias expand / canonicalize).
 *
 * Unlinked stores: read-time virtual singleton (no persisted identity row).
 * Master expand flag gates expandStoreIdsForRead only — helpers remain
 * testable with full expand while the live app stays exact-id until Slice 2.
 */

import {
  isStoreIdentityExpandEnabled,
  type StoreIdentityEnv,
} from "@/lib/store-identity-flags";
import type {
  StoreIdentityAliasRecord,
  StoreIdentityRecord,
} from "@/lib/store-identity-types";

export type StoreIdentityLookup = {
  getIdentity(identityId: string): StoreIdentityRecord | null;
  findAliasByStoreId(storeId: string): StoreIdentityAliasRecord | null;
  findAliasByExternalId(
    sourceSystem: string,
    externalId: string,
  ): StoreIdentityAliasRecord | null;
  listAliases(identityId: string): StoreIdentityAliasRecord[];
  listMemberStoreIds(identityId: string): string[];
  /**
   * When provided and false, unknown store ids do not become virtual
   * singletons (resolve returns null). When omitted, any unresolved store
   * id is treated as a virtual singleton.
   */
  isKnownStoreId?(storeId: string): boolean;
};

export type ResolvedStoreIdentity = StoreIdentityRecord & {
  aliases: StoreIdentityAliasRecord[];
  memberStoreIds: string[];
};

function virtualSingleton(storeId: string): ResolvedStoreIdentity {
  const alias: StoreIdentityAliasRecord = {
    identityId: storeId,
    sourceSystem: "yum4less-bootstrap",
    externalId: storeId,
    storeId,
    memberRole: "canonical",
    linkStatus: "confirmed",
    matchMethod: "virtual-singleton",
    matchConfidence: 1,
  };

  return {
    id: storeId,
    canonicalStoreId: storeId,
    isVirtualSingleton: true,
    aliases: [alias],
    memberStoreIds: [storeId],
  };
}

function resolveFromAlias(
  lookup: StoreIdentityLookup,
  alias: StoreIdentityAliasRecord,
): ResolvedStoreIdentity | null {
  const identity = lookup.getIdentity(alias.identityId);
  if (!identity) {
    return null;
  }

  return {
    ...identity,
    isVirtualSingleton: false,
    aliases: lookup.listAliases(alias.identityId),
    memberStoreIds: lookup.listMemberStoreIds(alias.identityId),
  };
}

/**
 * Resolve any store id or (sourceSystem, externalId) to an identity.
 * Unlinked known/assumed store ids → virtual singleton.
 */
export function resolveIdentity(
  lookup: StoreIdentityLookup,
  input:
    | { storeId: string }
    | { sourceSystem: string; externalId: string },
): ResolvedStoreIdentity | null {
  if ("storeId" in input) {
    const byStore = lookup.findAliasByStoreId(input.storeId);
    if (byStore) {
      return resolveFromAlias(lookup, byStore);
    }

    if (
      lookup.isKnownStoreId &&
      !lookup.isKnownStoreId(input.storeId)
    ) {
      return null;
    }

    return virtualSingleton(input.storeId);
  }

  const byExternal = lookup.findAliasByExternalId(
    input.sourceSystem,
    input.externalId,
  );
  if (byExternal) {
    return resolveFromAlias(lookup, byExternal);
  }

  return null;
}

/** Public/canonical stores.id for Settings persistence and API responses. */
export function canonicalizeStoreId(
  lookup: StoreIdentityLookup,
  storeId: string,
): string {
  const resolved = resolveIdentity(lookup, { storeId });
  return resolved?.canonicalStoreId ?? storeId;
}

/** Union of all member store ids for the given ids' identities. */
export function expandStoreIds(
  lookup: StoreIdentityLookup,
  storeIds: string[],
): string[] {
  const expanded = new Set<string>();

  for (const storeId of storeIds) {
    const resolved = resolveIdentity(lookup, { storeId });
    if (!resolved) {
      expanded.add(storeId);
      continue;
    }
    for (const memberId of resolved.memberStoreIds) {
      expanded.add(memberId);
    }
  }

  return [...expanded];
}

/**
 * Gated expand for future read paths. When master flag is OFF, returns
 * input ids unchanged (exact-id behavior).
 */
export function expandStoreIdsForRead(
  lookup: StoreIdentityLookup,
  storeIds: string[],
  env: StoreIdentityEnv = process.env,
): string[] {
  if (!isStoreIdentityExpandEnabled(env)) {
    return [...storeIds];
  }
  return expandStoreIds(lookup, storeIds);
}

export function listAliases(
  lookup: StoreIdentityLookup,
  identityId: string,
): StoreIdentityAliasRecord[] {
  const identity = lookup.getIdentity(identityId);
  if (identity) {
    return lookup.listAliases(identityId);
  }

  const asStore = resolveIdentity(lookup, { storeId: identityId });
  return asStore?.aliases ?? [];
}

/**
 * Future store-scope helper: which observation store ids are in scope for
 * the selected ids after expand. Used to pin the anti-pattern test that
 * exact-id-only expand must not silently empty pricing scope.
 */
export function scopeStoreIdsForPricing(input: {
  selectedIds: string[];
  observationStoreIds: string[];
  expand: (ids: string[]) => string[];
}): string[] {
  const expanded = new Set(input.expand(input.selectedIds));
  return input.observationStoreIds.filter((id) => expanded.has(id));
}

/**
 * Live-path default when expand is OFF or Postgres lookup is unavailable:
 * every store is a virtual singleton. Slice 5a adds createPostgresStoreIdentityLookup
 * for server paths when expand is ON. Tests inject fixtures via createMemoryStoreIdentityLookup.
 */
export function createDefaultStoreIdentityLookup(): StoreIdentityLookup {
  return createMemoryStoreIdentityLookup({
    identities: [],
    aliases: [],
  });
}

/** In-memory lookup for unit tests and Slice 1 fixtures. */
export function createMemoryStoreIdentityLookup(input: {
  identities: StoreIdentityRecord[];
  aliases: StoreIdentityAliasRecord[];
  knownStoreIds?: Iterable<string>;
}): StoreIdentityLookup {
  const identitiesById = new Map(
    input.identities.map((identity) => [identity.id, identity]),
  );
  const aliasesByIdentity = new Map<string, StoreIdentityAliasRecord[]>();
  const aliasByStoreId = new Map<string, StoreIdentityAliasRecord>();
  const aliasByExternal = new Map<string, StoreIdentityAliasRecord>();
  const known =
    input.knownStoreIds === undefined
      ? undefined
      : new Set(input.knownStoreIds);

  for (const alias of input.aliases) {
    const list = aliasesByIdentity.get(alias.identityId) ?? [];
    list.push(alias);
    aliasesByIdentity.set(alias.identityId, list);

    if (alias.storeId) {
      aliasByStoreId.set(alias.storeId, alias);
    }
    aliasByExternal.set(`${alias.sourceSystem}::${alias.externalId}`, alias);
  }

  return {
    getIdentity(identityId) {
      return identitiesById.get(identityId) ?? null;
    },
    findAliasByStoreId(storeId) {
      return aliasByStoreId.get(storeId) ?? null;
    },
    findAliasByExternalId(sourceSystem, externalId) {
      return aliasByExternal.get(`${sourceSystem}::${externalId}`) ?? null;
    },
    listAliases(identityId) {
      return [...(aliasesByIdentity.get(identityId) ?? [])];
    },
    listMemberStoreIds(identityId) {
      return (aliasesByIdentity.get(identityId) ?? [])
        .map((alias) => alias.storeId)
        .filter((storeId): storeId is string => Boolean(storeId));
    },
    isKnownStoreId: known
      ? (storeId) => known.has(storeId)
      : undefined,
  };
}
