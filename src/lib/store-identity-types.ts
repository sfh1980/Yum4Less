/**
 * Option A Slice 1 — store identity types (alias-graph model).
 * Schema: db/init/021_store_identities.sql
 */

export type StoreIdentityMemberRole = "canonical" | "alias";

export type StoreIdentityLinkStatus =
  | "confirmed"
  | "provisional"
  | "rejected";

/** Registered source_system keys (extensible; not a DB enum). */
export type StoreIdentitySourceSystem =
  | "yum4less-bootstrap"
  | "openstreetmap-overpass"
  | "yum4less-map-fixture"
  | "kroger-official-api"
  | "publix-store-locator"
  | "yum4less-market-catalog"
  | "usda-snap-retailer-locator"
  | "kroger-weekly-ad-scrape"
  | "aldi-weekly-ad-scrape"
  | "publix-weekly-ad-scrape"
  | "food-lion-weekly-ad-scrape"
  | "walmart-weekly-ad-scrape"
  | "lidl-weekly-ad-scrape"
  | "provider-search-cache"
  | (string & {});

export type StoreIdentityRecord = {
  id: string;
  canonicalStoreId: string;
  displayName?: string | null;
  kind?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  displaySourceName?: string | null;
  lastResolvedAt?: string | null;
  /** True when synthesized for an unlinked store (not persisted). */
  isVirtualSingleton: boolean;
};

export type StoreIdentityAliasRecord = {
  identityId: string;
  sourceSystem: string;
  externalId: string;
  storeId?: string | null;
  snapRetailerId?: string | null;
  memberRole: StoreIdentityMemberRole;
  linkStatus: StoreIdentityLinkStatus;
  matchMethod?: string | null;
  matchConfidence?: number | null;
  linkedAt?: string | null;
  notes?: string | null;
};

export type StoreIdentityMatchCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sourceSystem: string;
  externalId: string;
  /** Optional catalog source_store_id (pointer bonus when it matches the peer). */
  sourceStoreId?: string | null;
  kind?: string | null;
  /** OSM shop tag, SNAP retailer_type, or catalog kind hint. */
  typeHint?: string | null;
};
