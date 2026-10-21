import { getDbPool } from "@/lib/db";
import {
  MAP_ONLY_DISCOVERED_NOTE,
  matchChainIdByName,
  recordDiscoveredChainSaleFeed,
} from "@/lib/chain-registry-ensure";
import {
  insertPriceObservationIfChanged,
  parseObservationTimestamp,
} from "@/lib/price-observation-writes";
import { logServerError } from "@/lib/server-log";
import { flyerLineLooksLikeJunk } from "@/lib/weekly-ad-ingestion/weekly-ad-junk-heuristics";
import { MIN_WEEKLY_AD_MATCH_CONFIDENCE } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { matchWeeklyAdOffers } from "@/lib/weekly-ad-ingestion/weekly-ad-ingredient-matching";
import { resolveFlippWeeklyAdOffersForChain } from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-resolver";
import { isFixtureIngestMode } from "@/lib/fixture-ingest-policy";

type DiscoveredChainRow = {
  chain_id: string;
  display_name: string;
  name_match_fragments: string[] | null;
};

/**
 * Ask the shared flyer feed for a map-only chain. A flyer is saved on the
 * buildings we already have. No flyer leaves the chain on the map only.
 */
export async function tryDiscoveredChainFlyers(input: {
  zipCode: string;
  stores: readonly { id: string; name: string }[];
  trackedIngredientIds: string[];
}): Promise<void> {
  if (isFixtureIngestMode() || !process.env.DATABASE_URL || input.stores.length === 0) {
    return;
  }
  let chains: DiscoveredChainRow[] = [];
  try {
    const result = await getDbPool().query<DiscoveredChainRow>(
      `
        select chain_id, display_name, name_match_fragments
        from chain_registry
        where rollout_stage = 'map_context'
          and sale_discovery_strategy = 'none'
          and notes = $1
        order by display_name asc
      `,
      [MAP_ONLY_DISCOVERED_NOTE],
    );
    chains = result.rows;
  } catch (error) {
    logServerError("discovered-chain-flyer.list", error);
    return;
  }

  for (const chain of chains) {
    const registryRow = {
      chainId: chain.chain_id,
      displayName: chain.display_name,
      nameMatchFragments: chain.name_match_fragments ?? [],
    };
    const buildings = input.stores.filter(
      (store) => matchChainIdByName(store.name, [registryRow]) === chain.chain_id,
    );
    if (buildings.length === 0) {
      continue;
    }
    try {
      const flyer = await resolveFlippWeeklyAdOffersForChain({
        chain: chain.chain_id,
        zipCode: input.zipCode,
        merchantName: chain.display_name,
        trackedIngredientIds: input.trackedIngredientIds,
      });
      if (flyer.rawOffers.length === 0) {
        continue;
      }
      const offers = matchWeeklyAdOffers({
        chain: chain.chain_id,
        storeId: buildings[0]!.id,
        sourceUrl: "https://backflipp.wishabi.com/flipp/items/search",
        observedAt: new Date().toISOString(),
        rawOffers: flyer.rawOffers,
        trackedIngredientIds: input.trackedIngredientIds,
      });
      const sourceName = `${chain.chain_id}-weekly-ad-scrape`;
      let saved = 0;
      for (const building of buildings) {
        for (const offer of offers) {
          if (!offer.ingredientId || flyerLineLooksLikeJunk(offer.productName)) {
            continue;
          }
          if (
            offer.matchConfidence !== undefined &&
            offer.matchConfidence < MIN_WEEKLY_AD_MATCH_CONFIDENCE
          ) {
            continue;
          }
          const outcome = await insertPriceObservationIfChanged({
            storeId: building.id,
            ingredientId: offer.ingredientId,
            price: offer.price,
            saleLabel: offer.saleLabel ?? `${chain.display_name} weekly-ad special`,
            observedAt: parseObservationTimestamp(offer.observedAt),
            sourceName,
            sourceRecordId: `${building.id}:${offer.ingredientId}:${offer.productName}`,
            confidenceScore: offer.matchConfidence ?? offer.confidenceScore,
            notes: `${chain.display_name} prices are from the shared flyer feed. Totals are estimated.`,
            ...(offer.validThrough
              ? { validThrough: parseObservationTimestamp(offer.validThrough) }
              : {}),
          });
          if (outcome === "inserted") {
            saved += 1;
          }
        }
      }
      if (saved > 0) {
        await recordDiscoveredChainSaleFeed({
          chainId: chain.chain_id,
          merchantName: chain.display_name,
        });
      }
    } catch (error) {
      logServerError("discovered-chain-flyer.try", error, {
        chainId: chain.chain_id,
        zipCode: input.zipCode,
      });
    }
  }
}
