/**
 * Option A Slice 3 — Settings-only narrow known-pair identity lookup.
 *
 * INTENTIONALLY NARROW: Mechanicsville Kroger slug↔API twin only.
 * Does not generalize to the next chain. Named debt in PROJECT_CONTINUITY.md —
 * revisit before/during Slice 4 (Aldi) or accept per-slice known pairs interim.
 *
 * Master expand flag gates all remapping; flag OFF → exact-id (today's behavior).
 */

import {
  isStoreIdentityExpandEnabled,
  type StoreIdentityEnv,
} from "@/lib/store-identity-flags";
import {
  canonicalizeStoreId,
  createMemoryStoreIdentityLookup,
  expandStoreIds,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";
import type {
  StoreIdentityAliasRecord,
  StoreIdentityRecord,
} from "@/lib/store-identity-types";

/** Canonical public id (Q3 official-wins). */
export const SETTINGS_KNOWN_KROGER_CANONICAL_ID = "kroger-02900529";

/** Bootstrap / weekly-ad slug alias still present in localStorage for many users. */
export const SETTINGS_KNOWN_KROGER_ALIAS_ID = "kroger-mechanicsville";

const KROGER_IDENTITY: StoreIdentityRecord = {
  id: SETTINGS_KNOWN_KROGER_CANONICAL_ID,
  canonicalStoreId: SETTINGS_KNOWN_KROGER_CANONICAL_ID,
  displayName: "Kroger Marketplace - Kroger Marketplace",
  kind: "grocery",
  city: "Mechanicsville",
  state: "VA",
  latitude: 37.61546,
  longitude: -77.32939,
  displaySourceName: "kroger-official-api",
  isVirtualSingleton: false,
};

const KROGER_ALIASES: StoreIdentityAliasRecord[] = [
  {
    identityId: SETTINGS_KNOWN_KROGER_CANONICAL_ID,
    sourceSystem: "kroger-official-api",
    externalId: "02900529",
    storeId: SETTINGS_KNOWN_KROGER_CANONICAL_ID,
    memberRole: "canonical",
    linkStatus: "confirmed",
    matchMethod: "seeded",
    matchConfidence: 0.85,
  },
  {
    identityId: SETTINGS_KNOWN_KROGER_CANONICAL_ID,
    sourceSystem: "kroger-weekly-ad-scrape",
    externalId: SETTINGS_KNOWN_KROGER_ALIAS_ID,
    storeId: SETTINGS_KNOWN_KROGER_ALIAS_ID,
    memberRole: "alias",
    linkStatus: "confirmed",
    matchMethod: "seeded",
    matchConfidence: 0.85,
  },
];

/**
 * Client-safe memory lookup mirroring migration 022's seeded Kroger pair.
 * Not a general identity API — see continuity named debt.
 */
export function createSettingsKnownPairIdentityLookup(): StoreIdentityLookup {
  return createMemoryStoreIdentityLookup({
    identities: [KROGER_IDENTITY],
    aliases: KROGER_ALIASES,
    knownStoreIds: [
      SETTINGS_KNOWN_KROGER_CANONICAL_ID,
      SETTINGS_KNOWN_KROGER_ALIAS_ID,
    ],
  });
}

/** Flag-gated canonicalize for Settings persist/hydrate. */
export function canonicalizeStoreIdsForSettings(
  storeIds: string[],
  env: StoreIdentityEnv = process.env,
  lookup: StoreIdentityLookup = createSettingsKnownPairIdentityLookup(),
): string[] {
  if (!isStoreIdentityExpandEnabled(env)) {
    return [...storeIds];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const storeId of storeIds) {
    const canonical = canonicalizeStoreId(lookup, storeId);
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/**
 * Membership filter that accepts alias ids when a linked selectable member
 * is present — Settings equivalent of Slice 2 silent-empty guard.
 */
export function filterSelectedStoreIdsAgainstSelectable(
  selectedIds: string[],
  enabledSelectableIds: ReadonlySet<string>,
  env: StoreIdentityEnv = process.env,
  lookup: StoreIdentityLookup = createSettingsKnownPairIdentityLookup(),
): string[] {
  if (!isStoreIdentityExpandEnabled(env)) {
    return selectedIds.filter((storeId) => enabledSelectableIds.has(storeId));
  }

  const kept: string[] = [];
  const seen = new Set<string>();

  for (const storeId of selectedIds) {
    const members = expandStoreIds(lookup, [storeId]);
    const hit = members.find((memberId) => enabledSelectableIds.has(memberId));
    if (!hit) {
      continue;
    }

    const canonical = canonicalizeStoreId(lookup, storeId);
    const preferred = enabledSelectableIds.has(canonical) ? canonical : hit;
    if (seen.has(preferred)) {
      continue;
    }
    seen.add(preferred);
    kept.push(preferred);
  }

  return kept;
}

/** Checkbox/select: treat alias and canonical as the same selection when flag ON. */
export function isSettingsStoreIdSelected(
  selectedIds: readonly string[],
  storeId: string,
  env: StoreIdentityEnv = process.env,
  lookup: StoreIdentityLookup = createSettingsKnownPairIdentityLookup(),
): boolean {
  if (selectedIds.includes(storeId)) {
    return true;
  }
  if (!isStoreIdentityExpandEnabled(env)) {
    return false;
  }

  const storeCanonical = canonicalizeStoreId(lookup, storeId);
  return selectedIds.some(
    (selectedId) => canonicalizeStoreId(lookup, selectedId) === storeCanonical,
  );
}
