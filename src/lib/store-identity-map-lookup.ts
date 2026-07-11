/**
 * Option A Slice 5b — client identity lookup for Map pin scope/highlight.
 *
 * Broader than Settings known-pair (Kroger-only): includes Aldi↔OSM seed pair
 * so expand-aware map scoping can resolve stale alias selections when the
 * server already collapsed nearbyStores to canonical ids.
 *
 * Does NOT drive Settings checkbox remapping — that stays Kroger-only in
 * store-identity-settings-lookup.ts.
 */

import {
  createMemoryStoreIdentityLookup,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";
import type {
  StoreIdentityAliasRecord,
  StoreIdentityRecord,
} from "@/lib/store-identity-types";
import {
  SETTINGS_KNOWN_KROGER_ALIAS_ID,
  SETTINGS_KNOWN_KROGER_CANONICAL_ID,
} from "@/lib/store-identity-settings-lookup";

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

export const MAP_KNOWN_ALDI_CANONICAL_ID = "aldi-mechanicsville";
export const MAP_KNOWN_ALDI_OSM_ALIAS_ID = "osm-node-6531578976";

const ALDI_IDENTITY: StoreIdentityRecord = {
  id: MAP_KNOWN_ALDI_CANONICAL_ID,
  canonicalStoreId: MAP_KNOWN_ALDI_CANONICAL_ID,
  displayName: "Aldi",
  kind: "grocery",
  city: "Mechanicsville",
  state: "VA",
  latitude: 37.611004,
  longitude: -77.336853,
  displaySourceName: "aldi-weekly-ad-scrape",
  isVirtualSingleton: false,
};

const ALDI_ALIASES: StoreIdentityAliasRecord[] = [
  {
    identityId: MAP_KNOWN_ALDI_CANONICAL_ID,
    sourceSystem: "aldi-weekly-ad-scrape",
    externalId: MAP_KNOWN_ALDI_CANONICAL_ID,
    storeId: MAP_KNOWN_ALDI_CANONICAL_ID,
    memberRole: "canonical",
    linkStatus: "confirmed",
    matchMethod: "seeded",
    matchConfidence: 0.985,
  },
  {
    identityId: MAP_KNOWN_ALDI_CANONICAL_ID,
    sourceSystem: "openstreetmap-overpass",
    externalId: MAP_KNOWN_ALDI_OSM_ALIAS_ID,
    storeId: MAP_KNOWN_ALDI_OSM_ALIAS_ID,
    memberRole: "alias",
    linkStatus: "confirmed",
    matchMethod: "seeded",
    matchConfidence: 0.985,
  },
];

/**
 * Client-safe memory lookup mirroring seeds 022 + 023 for Map expand-aware
 * scope and highlight. Flag still gates all expand via expandStoreIdsForRead.
 */
export function createMapPinIdentityLookup(): StoreIdentityLookup {
  return createMemoryStoreIdentityLookup({
    identities: [KROGER_IDENTITY, ALDI_IDENTITY],
    aliases: [...KROGER_ALIASES, ...ALDI_ALIASES],
    knownStoreIds: [
      SETTINGS_KNOWN_KROGER_CANONICAL_ID,
      SETTINGS_KNOWN_KROGER_ALIAS_ID,
      MAP_KNOWN_ALDI_CANONICAL_ID,
      MAP_KNOWN_ALDI_OSM_ALIAS_ID,
    ],
  });
}
