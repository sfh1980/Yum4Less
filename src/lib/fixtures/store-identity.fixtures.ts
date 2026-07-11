/**
 * Shared Option A identity fixtures for Slice 1–4 validation.
 * Coords pinned so distance assertions stay stable.
 */

import { getDistanceMiles } from "@/lib/geo-distance";
import type { StoreIdentityMatchCandidate } from "@/lib/store-identity-types";
import {
  createMemoryStoreIdentityLookup,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";
import type {
  StoreIdentityAliasRecord,
  StoreIdentityRecord,
} from "@/lib/store-identity-types";

/** Live Mechanicsville Kroger API pin (canonical under Q3). */
export const FIXTURE_KROGER_API: StoreIdentityMatchCandidate = {
  id: "kroger-02900529",
  name: "Kroger Marketplace - Kroger Marketplace",
  latitude: 37.61546,
  longitude: -77.32939,
  sourceSystem: "kroger-official-api",
  externalId: "02900529",
  sourceStoreId: "02900529",
  kind: "grocery",
  typeHint: "grocery",
};

/** Bootstrap/weekly-ad slug twin ~0.0001 mi from API pin. */
export const FIXTURE_KROGER_SLUG: StoreIdentityMatchCandidate = {
  id: "kroger-mechanicsville",
  name: "Kroger",
  latitude: 37.6154615,
  longitude: -77.32939,
  sourceSystem: "kroger-weekly-ad-scrape",
  externalId: "kroger-mechanicsville",
  sourceStoreId: "kroger-mechanicsville",
  kind: "grocery",
  typeHint: "grocery",
};

/** Ranked Aldi catalog row with OSM pointer. */
export const FIXTURE_ALDI_CATALOG: StoreIdentityMatchCandidate = {
  id: "aldi-mechanicsville",
  name: "Aldi",
  latitude: 37.611004,
  longitude: -77.336853,
  sourceSystem: "aldi-weekly-ad-scrape",
  externalId: "aldi-mechanicsville",
  sourceStoreId: "osm-node-6531578976",
  kind: "grocery",
  typeHint: "grocery",
};

/** Live OSM Aldi at identical coords. */
export const FIXTURE_ALDI_OSM: StoreIdentityMatchCandidate = {
  id: "osm-node-6531578976",
  name: "ALDI",
  latitude: 37.611004,
  longitude: -77.336853,
  sourceSystem: "openstreetmap-overpass",
  externalId: "osm-node-6531578976",
  sourceStoreId: "osm-node-6531578976",
  kind: "grocery",
  typeHint: "supermarket",
};

/**
 * Two same-brand Food Lion storefronts ~0.21 mi apart — must NOT confirm.
 * Offset ~0.00305° latitude ≈ 0.21 mi.
 */
export const FIXTURE_FOOD_LION_A: StoreIdentityMatchCandidate = {
  id: "food-lion-mechanicsville",
  name: "Food Lion",
  latitude: 37.610174,
  longitude: -77.341778,
  sourceSystem: "food-lion-weekly-ad-scrape",
  externalId: "food-lion-mechanicsville",
  sourceStoreId: "food-lion-mechanicsville",
  kind: "grocery",
  typeHint: "grocery",
};

export const FIXTURE_FOOD_LION_B_NEARBY: StoreIdentityMatchCandidate = {
  id: "food-lion-other-plaza",
  name: "Food Lion",
  latitude: 37.610174 + 0.00305,
  longitude: -77.341778,
  sourceSystem: "openstreetmap-overpass",
  externalId: "osm-node-food-lion-other",
  sourceStoreId: "osm-node-food-lion-other",
  kind: "grocery",
  typeHint: "supermarket",
};

export function assertFixtureDistances(): {
  krogerMiles: number;
  aldiMiles: number;
  foodLionMiles: number;
} {
  return {
    krogerMiles: getDistanceMiles(
      FIXTURE_KROGER_API.latitude,
      FIXTURE_KROGER_API.longitude,
      FIXTURE_KROGER_SLUG.latitude,
      FIXTURE_KROGER_SLUG.longitude,
    ),
    aldiMiles: getDistanceMiles(
      FIXTURE_ALDI_CATALOG.latitude,
      FIXTURE_ALDI_CATALOG.longitude,
      FIXTURE_ALDI_OSM.latitude,
      FIXTURE_ALDI_OSM.longitude,
    ),
    foodLionMiles: getDistanceMiles(
      FIXTURE_FOOD_LION_A.latitude,
      FIXTURE_FOOD_LION_A.longitude,
      FIXTURE_FOOD_LION_B_NEARBY.latitude,
      FIXTURE_FOOD_LION_B_NEARBY.longitude,
    ),
  };
}

/** Linked Kroger identity graph for expand/canonicalize tests (Q3 canonical = API). */
export function createLinkedKrogerIdentityLookup(): StoreIdentityLookup {
  const identity: StoreIdentityRecord = {
    id: "kroger-02900529",
    canonicalStoreId: "kroger-02900529",
    displayName: "Kroger Marketplace - Kroger Marketplace",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: FIXTURE_KROGER_API.latitude,
    longitude: FIXTURE_KROGER_API.longitude,
    displaySourceName: "kroger-official-api",
    isVirtualSingleton: false,
  };

  const aliases: StoreIdentityAliasRecord[] = [
    {
      identityId: identity.id,
      sourceSystem: "kroger-official-api",
      externalId: "02900529",
      storeId: "kroger-02900529",
      memberRole: "canonical",
      linkStatus: "confirmed",
      matchMethod: "proximity+name",
      matchConfidence: 0.95,
    },
    {
      identityId: identity.id,
      sourceSystem: "kroger-weekly-ad-scrape",
      externalId: "kroger-mechanicsville",
      storeId: "kroger-mechanicsville",
      memberRole: "alias",
      linkStatus: "confirmed",
      matchMethod: "proximity+name",
      matchConfidence: 0.95,
    },
  ];

  return createMemoryStoreIdentityLookup({
    identities: [identity],
    aliases,
    knownStoreIds: ["kroger-02900529", "kroger-mechanicsville", "aldi-mechanicsville"],
  });
}

/** Linked Aldi + OSM identity (catalog canonical; OSM alias). */
export function createLinkedAldiOsmIdentityLookup(): StoreIdentityLookup {
  const identity: StoreIdentityRecord = {
    id: "aldi-mechanicsville",
    canonicalStoreId: "aldi-mechanicsville",
    displayName: "Aldi",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: FIXTURE_ALDI_CATALOG.latitude,
    longitude: FIXTURE_ALDI_CATALOG.longitude,
    displaySourceName: "aldi-weekly-ad-scrape",
    isVirtualSingleton: false,
  };

  const aliases: StoreIdentityAliasRecord[] = [
    {
      identityId: identity.id,
      sourceSystem: "aldi-weekly-ad-scrape",
      externalId: "aldi-mechanicsville",
      storeId: "aldi-mechanicsville",
      memberRole: "canonical",
      linkStatus: "confirmed",
      matchMethod: "seeded",
      matchConfidence: 0.985,
    },
    {
      identityId: identity.id,
      sourceSystem: "openstreetmap-overpass",
      externalId: "osm-node-6531578976",
      storeId: "osm-node-6531578976",
      memberRole: "alias",
      linkStatus: "confirmed",
      matchMethod: "seeded",
      matchConfidence: 0.985,
    },
  ];

  return createMemoryStoreIdentityLookup({
    identities: [identity],
    aliases,
    knownStoreIds: [
      "aldi-mechanicsville",
      "osm-node-6531578976",
      "kroger-mechanicsville",
    ],
  });
}
