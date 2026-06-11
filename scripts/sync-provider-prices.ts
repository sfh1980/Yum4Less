import { loadEnvLocal } from "@/lib/load-env-local";
import { resolveLocationInput } from "@/lib/location-resolution";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { searchOfficialProviderStores } from "@/lib/provider-market-service";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import { syncProviderPreviewsToPriceObservations } from "@/lib/provider-price-observation-sync";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";
import {
  parseIngestZipCodesFromEnv,
  syncV1ChainStoresToCatalog,
} from "@/lib/store-catalog-sync";

loadEnvLocal();

const DEFAULT_RADIUS_MILES = Number(process.env.YUM4LESS_PROVIDER_SYNC_RADIUS_MILES ?? 8);

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const zipCodes = parseIngestZipCodesFromEnv();
  let totalSynced = 0;

  for (const zipCode of zipCodes) {
    const locationResult = await resolveLocationInput({ zipCode });
    if (!locationResult.ok) {
      console.warn(`[sync:skip] ZIP ${zipCode}: ${locationResult.error}`);
      continue;
    }

    const providerStoreSearches = await searchOfficialProviderStores({
      location: locationResult.location,
      radiusMiles: DEFAULT_RADIUS_MILES,
      readMode: "live-allowed",
    });
    const upserted = await syncV1ChainStoresToCatalog({
      location: locationResult.location,
      zipCode,
      providerStoreSearches,
    });
    console.log(
      `[sync:${zipCode}] upserted ${upserted} Kroger-family/Aldi catalog store row(s).`,
    );

    const providerPricingPreviews = await buildProviderPricingPreviews({
      providerStores: providerStoreSearches.flatMap((search) => search.stores),
      readMode: "live-allowed",
    });
    const { snapshot } = await getMarketDataSnapshot();
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
      console.log(
        `[sync:${summary.provider}] synced=${summary.syncedCount}, skipped=${summary.skippedCount}`,
      );
      console.log(`  ${summary.message}`);
      if (summary.syncedCount === 0 && summary.provider === "kroger") {
        console.log(
          "  Kroger official preview sync wrote 0 rows this run — weekly-ad prices may still rank when gates pass. Product matching and certification vs production API limits are common causes; verify with npm run test:kroger-api.",
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
}

function toNearbyStoreSummary(
  store: Awaited<ReturnType<typeof getMarketDataSnapshot>>["snapshot"]["stores"][number],
): NearbyStoreSummary {
  const rollout = getProviderRolloutForStore(store.name);

  return {
    id: store.id,
    name: store.name,
    kind: store.kind,
    latitude: store.latitude,
    longitude: store.longitude,
    distanceMiles: 0,
    chain: rollout.chain,
    chainLabel: rollout.label,
    rolloutStatus: rollout.status,
    recommendationEnabled: rollout.recommendationEnabled,
    rolloutNote: rollout.note,
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
