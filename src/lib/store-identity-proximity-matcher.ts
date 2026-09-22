/**
 * Slice D — catalog-only OSM ↔ official proximity matcher.
 *
 * High-confidence same-chain parking-lot pairs can be written as provisional
 * aliases. AUTO_CONFIRM stays off (never writes link_status=confirmed here).
 * Search-time ephemeral pins are not inputs.
 */

import { inferStoreChainFromCatalog } from "@/lib/chain-rollout-policy";
import type { CatalogStore } from "@/lib/market-catalog-types";
import {
  OSM_MAP_CATALOG_SOURCE,
  OSM_MAP_FIXTURE_SOURCE,
} from "@/lib/osm-food-retail-discovery";
import {
  scoreStoreIdentityMatch,
  type StoreIdentityMatchScore,
} from "@/lib/store-identity-match-policy";
import type { StoreIdentityMatchCandidate } from "@/lib/store-identity-types";

const OFFICIAL_IDENTITY_SOURCES = new Set([
  "kroger-official-api",
  "publix-store-locator",
  "target-store-locator",
  "yum4less-market-catalog",
]);

export type StoreIdentityProximityPair = {
  osm: CatalogStore;
  official: CatalogStore;
  chainId: string;
  score: StoreIdentityMatchScore;
};

export type StoreIdentityProximityProposal = {
  write: StoreIdentityProximityPair[];
  review: StoreIdentityProximityPair[];
};

export function isOsmIdentityCatalogStore(store: Pick<CatalogStore, "id" | "sourceName">): boolean {
  const source = store.sourceName?.trim() ?? "";
  if (source === OSM_MAP_CATALOG_SOURCE || source === OSM_MAP_FIXTURE_SOURCE) {
    return true;
  }
  return /^(?:fixture-)?osm-(?:node|way)-/i.test(store.id);
}

export function isOfficialIdentityCatalogStore(
  store: Pick<CatalogStore, "sourceName">,
): boolean {
  const source = store.sourceName?.trim() ?? "";
  return OFFICIAL_IDENTITY_SOURCES.has(source);
}

function toCandidate(store: CatalogStore): StoreIdentityMatchCandidate {
  const sourceSystem = store.sourceName?.trim() || "unknown";
  return {
    id: store.id,
    name: store.name,
    latitude: store.latitude,
    longitude: store.longitude,
    sourceSystem,
    externalId: store.sourceStoreId?.trim() || store.id,
    sourceStoreId: store.sourceStoreId,
    kind: store.kind,
  };
}

/**
 * Propose OSM↔official same-chain links. Each OSM and official pin is used at
 * most once. Confirmed scores go to `write` (still stored as provisional).
 * Provisional scores wait for owner review.
 */
export function proposeStoreIdentityProximityMatches(
  stores: readonly CatalogStore[],
): StoreIdentityProximityProposal {
  const osmStores = stores.filter(isOsmIdentityCatalogStore);
  const officialStores = stores.filter(isOfficialIdentityCatalogStore);
  const usedOfficial = new Set<string>();
  const usedOsm = new Set<string>();
  const write: StoreIdentityProximityPair[] = [];
  const review: StoreIdentityProximityPair[] = [];

  const scored: StoreIdentityProximityPair[] = [];
  for (const osm of osmStores) {
    const osmChain = inferStoreChainFromCatalog({
      id: osm.id,
      name: osm.name,
      sourceName: osm.sourceName,
    });
    if (osmChain === "unknown") {
      continue;
    }
    for (const official of officialStores) {
      const officialChain = inferStoreChainFromCatalog({
        id: official.id,
        name: official.name,
        sourceName: official.sourceName,
      });
      if (officialChain !== osmChain) {
        continue;
      }
      const score = scoreStoreIdentityMatch(toCandidate(osm), toCandidate(official));
      if (score.classification === "none") {
        continue;
      }
      scored.push({ osm, official, chainId: osmChain, score });
    }
  }

  scored.sort((left, right) => {
    const confidence = right.score.confidence - left.score.confidence;
    if (confidence !== 0) {
      return confidence;
    }
    return left.score.miles - right.score.miles;
  });

  for (const pair of scored) {
    if (usedOsm.has(pair.osm.id) || usedOfficial.has(pair.official.id)) {
      continue;
    }
    usedOsm.add(pair.osm.id);
    usedOfficial.add(pair.official.id);
    if (pair.score.classification === "confirmed") {
      write.push(pair);
    } else {
      review.push(pair);
    }
  }

  return { write, review };
}
