import { createPublixServicesApiClient } from "../src/lib/providers/publix/publix-services-api-client.ts";
import { resolvePublixStoreForZip } from "../src/lib/weekly-ad-ingestion/publix-weekly-ad-store.ts";
import { resolveRequiredProbeZipCode } from "../src/lib/ingest-zip-codes.ts";
import { loadEnvLocal } from "./lib/load-env-local.mjs";

loadEnvLocal();

const zipCode = resolveRequiredProbeZipCode();

async function main() {
  console.log(`\n=== Publix API setup probe (ZIP ${zipCode}) ===\n`);
  const api = createPublixServicesApiClient();
  const stores = await api.searchStoresByZip({ zipCode, count: 3 });
  const storeContext = await resolvePublixStoreForZip(zipCode);

  console.log(`Stores returned: ${stores.length}`);
  for (const store of stores) {
    console.log(
      ` - ${store.KEY} ${store.NAME} (${store.CITY}, ${store.STATE}) ~${store.DISTANCE} mi`,
    );
  }

  console.log(`\nSelected store cookie: ${storeContext.storeCookie ? "yes" : "no"}`);
  if (storeContext.storeCookie) {
    console.log(
      `StoreNumber ${storeContext.storeCookie.StoreNumber}, Option ${storeContext.storeCookie.Option}`,
    );
  }

    console.log(
      "\nPublix has no direct developer API. Store lookup uses the website locator service; product/weekly-ad pricing would typically come from a third-party such as Apify (not wired in this MVP).\n",
    );

  process.exit(stores.length > 0 && storeContext.storeCookie ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
