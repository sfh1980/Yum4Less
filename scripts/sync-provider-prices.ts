import { loadEnvLocal } from "@/lib/load-env-local";
import { resolveLocationInput } from "@/lib/location-resolution";
import { getMarketDataSnapshot } from "@/lib/market-repository";
import { searchOfficialProviderStores } from "@/lib/provider-market-service";
import { buildProviderPricingPreviews } from "@/lib/provider-pricing-preview-service";
import { getProviderRolloutForStore } from "@/lib/provider-rollout";
import { syncProviderPreviewsToPriceObservations } from "@/lib/provider-price-observation-sync";
import type { NearbyStoreSummary } from "@/lib/recommendation-service";

loadEnvLocal();

const DEFAULT_ZIP = process.env.YUM4LESS_PROVIDER_SYNC_ZIP ?? "23111";
const DEFAULT_RADIUS_MILES = Number(process.env.YUM4LESS_PROVIDER_SYNC_RADIUS_MILES ?? 8);

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const locationResult = await resolveLocationInput({ zipCode: DEFAULT_ZIP });
  if (!locationResult.ok) {
    throw new Error(locationResult.error);
  }

  const providerStoreSearches = await searchOfficialProviderStores({
    location: locationResult.location,
    radiusMiles: DEFAULT_RADIUS_MILES,
  });
  const providerPricingPreviews = await buildProviderPricingPreviews({
    providerStores: providerStoreSearches.flatMap((search) => search.stores),
  });
  const { snapshot } = await getMarketDataSnapshot();
  const nearbyStores = snapshot.stores.map(toNearbyStoreSummary);
  const summaries = await syncProviderPreviewsToPriceObservations({
    previews: providerPricingPreviews,
    nearbyStores,
  });

  console.log(
    `Provider price sync checked ${providerPricingPreviews.length} provider preview(s) near ZIP ${DEFAULT_ZIP}.`,
  );

  for (const summary of summaries) {
    console.log(
      `[sync:${summary.provider}] synced=${summary.syncedCount}, skipped=${summary.skippedCount}`,
    );
    console.log(`  ${summary.message}`);
  }

  if (summaries.length === 0) {
    console.log("No provider previews were eligible for price observation sync.");
  }
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
