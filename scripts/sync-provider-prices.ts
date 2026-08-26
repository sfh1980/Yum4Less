import { rememberIngestZipGeocode } from "@/lib/zip-geocode-cache";
import { getDbPool } from "@/lib/db";
import { enforceFixtureIngestDatabasePolicy } from "@/lib/fixture-ingest-policy";
import { loadEnvLocal } from "@/lib/load-env-local";
import { resolveLocationInput } from "@/lib/location-resolution";
import { discoverFoodRetailStoresNearLocation } from "@/lib/osm-food-retail-discovery";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { searchOfficialProviderStores } from "@/lib/provider-market-service";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import { resolveKrogerSyncTrackedIngredients } from "@/lib/provider-search-terms";
import { resolvePreferredKrogerLocationIdForZip } from "@/lib/kroger-preferred-location";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import { syncProviderPreviewsToPriceObservations } from "@/lib/provider-price-observation-sync";
import { purgeStaleRankedPriceObservations } from "@/lib/price-observation-writes";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import {
  buildStoreMapLocationBadge,
  buildStoreMapLocationNote,
  resolveStoreMapLocationProvenance,
} from "@/lib/store-map-location-copy";
import {
  resolveScheduledIngestZipCodes,
  syncV1ChainStoresToCatalog,
} from "@/lib/store-catalog-sync";
import { shouldFailProviderPriceSyncExit } from "@/lib/ingest/ingest-script-exit-policy";

loadEnvLocal();

const DEFAULT_RADIUS_MILES = Number(process.env.YUM4LESS_PROVIDER_SYNC_RADIUS_MILES ?? 8);
const MAP_CATALOG_RADIUS_MILES = Number(
  process.env.YUM4LESS_MAP_CATALOG_RADIUS_MILES ?? 12,
);
const USE_MAP_FIXTURE =
  process.argv.includes("--fixture") ||
  process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1";

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  if (USE_MAP_FIXTURE) {
    process.env.YUM4LESS_MAP_CATALOG_FIXTURE = "1";
    enforceFixtureIngestDatabasePolicy();
  }

  const zipCodes = await resolveScheduledIngestZipCodes();
  let totalSynced = 0;
  const allSummaries: Awaited<
    ReturnType<typeof syncProviderPreviewsToPriceObservations>
  > = [];
  const purgedStale = await purgeStaleRankedPriceObservations();
  if (purgedStale > 0) {
    console.log(`[sync] purged ${purgedStale} stale ranked price observation row(s).`);
  }

  for (const zipCode of zipCodes) {
    const locationResult = await resolveLocationInput({ zipCode });
    if (!locationResult.ok) {
      console.warn(`[sync:skip] ZIP ${zipCode}: ${locationResult.error}`);
      continue;
    }

    await rememberIngestZipGeocode({
      ...locationResult.location,
      zipCode,
    });

    const providerStoreSearches = await searchOfficialProviderStores({
      location: locationResult.location,
      radiusMiles: DEFAULT_RADIUS_MILES,
      readMode: "live-allowed",
    });
    const osmDiscovery = await discoverFoodRetailStoresNearLocation({
      latitude: locationResult.location.latitude,
      longitude: locationResult.location.longitude,
      radiusMiles: MAP_CATALOG_RADIUS_MILES,
      zipCode,
      useFixture: USE_MAP_FIXTURE,
    });
    const upserted = await syncV1ChainStoresToCatalog({
      location: locationResult.location,
      zipCode,
      providerStoreSearches,
      osmFoodRetailStores: osmDiscovery.stores,
    });
    console.log(
      `[sync:${zipCode}] upserted ${upserted} Kroger-family/Aldi catalog store row(s).`,
    );

    const preferredKrogerLocationId = await resolvePreferredKrogerLocationIdForZip({
      location: locationResult.location,
      pool: getDbPool(),
    });
    if (!preferredKrogerLocationId) {
      console.warn(
        `[sync:${zipCode}] no preferred Kroger locationId resolved (no-kroger-store-found); official Kroger previews skipped.`,
      );
    }

    const { snapshot } = await getMarketDataSnapshot();

    const syncTrackedIngredients = await resolveKrogerSyncTrackedIngredients(getDbPool());
    const providerPricingPreviews = await buildProviderPricingPreviews({
      providerStores: providerStoreSearches.flatMap((search) => search.stores),
      readMode: "live-allowed",
      preferredProviderStoreIds: preferredKrogerLocationId
        ? { kroger: preferredKrogerLocationId }
        : undefined,
      trackedIngredients: syncTrackedIngredients,
    });
    const nearbyStores = snapshot.stores.map(toNearbyStoreSummary);
    const summaries = await syncProviderPreviewsToPriceObservations({
      previews: providerPricingPreviews,
      nearbyStores,
    });

    console.log(
      `Provider price sync checked ${providerPricingPreviews.length} provider preview(s) near ZIP ${zipCode}.`,
    );

    for (const summary of summaries) {
      totalSynced += summary.syncedCount;
      allSummaries.push(summary);
      const storeHint = summary.internalStoreId
        ? ` store=${summary.internalStoreId}`
        : "";
      console.log(
        `[sync:${summary.provider}] synced=${summary.syncedCount}, unchanged=${summary.unchangedCount}, skipped=${summary.skippedCount}${storeHint}`,
      );
      if (summary.skipReason) {
        console.log(`  skip_reason=${summary.skipReason}`);
      }
      console.log(`  ${summary.message}`);
      if (
        summary.syncedCount === 0 &&
        summary.unchangedCount === 0 &&
        summary.provider === "kroger"
      ) {
        console.log(
          "  Kroger official preview sync wrote 0 rows this run — weekly-ad prices may still rank when gates pass. Common causes: KROGER_API_ENV not production, store-mapping-failed (locationId vs nearest catalog row), weak product match, or no usable store price. Verify with npm run probe:kroger-api and npm run sync:provider-prices.",
        );
      }
    }

    if (summaries.length === 0) {
      console.log("No provider previews were eligible for price observation sync.");
    }
  }

  console.log(
    `Provider price sync finished for ${zipCodes.length} ZIP(s); ${totalSynced} row(s) synced.`,
  );

  if (shouldFailProviderPriceSyncExit(allSummaries)) {
    const failedCount = allSummaries.reduce(
      (total, summary) => total + summary.failedCount,
      0,
    );
    console.error(
      `Provider price sync finished with ${failedCount} persist failure(s). See structured error logs above.`,
    );
    process.exit(1);
  }
}

function toNearbyStoreSummary(
  store: Awaited<ReturnType<typeof getMarketDataSnapshot>>["snapshot"]["stores"][number],
): NearbyStoreSummary {
  const rollout = getProviderRolloutForStore(store.name);

  const locationInput = {
    storeId: store.id,
    sourceName: store.sourceName,
    lastVerifiedAt: store.lastVerifiedAt,
  };

  return {
    id: store.id,
    name: store.name,
    city: store.city,
    state: store.state,
    kind: store.kind,
    latitude: store.latitude,
    longitude: store.longitude,
    distanceMiles: 0,
    chain: rollout.chain,
    chainLabel: rollout.label,
    rolloutStatus: rollout.status,
    recommendationEnabled: rollout.recommendationEnabled,
    rolloutNote: rollout.note,
    sourceName: store.sourceName,
    sourceStoreId: store.sourceStoreId,
    lastVerifiedAt: store.lastVerifiedAt,
    locationProvenance: resolveStoreMapLocationProvenance(locationInput),
    locationBadge: buildStoreMapLocationBadge(locationInput),
    locationNote: buildStoreMapLocationNote(locationInput),
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
