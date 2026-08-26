import { upsertActiveMarket } from "@/lib/active-markets";
import { resolveZipLocation } from "@/lib/geocoding";
import { loadEnvLocal } from "@/lib/load-env-local";
import { rememberIngestZipGeocode } from "@/lib/zip-geocode-cache";

loadEnvLocal();

async function main() {
  const zipCode = process.argv[2]?.trim();
  if (!zipCode || !/^\d{5}$/.test(zipCode)) {
    console.error(
      "Usage: npm run markets:activate -- <5-digit-ZIP>\nExample: npm run markets:activate -- 23220",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const resolved = await resolveZipLocation(zipCode);
  if (!resolved.ok) {
    console.error(`Could not geocode ZIP ${zipCode}: ${resolved.error}`);
    process.exit(1);
  }

  process.env.YUM4LESS_ZIP_GEOCODE_CACHE = "1";
  await upsertActiveMarket({
    zipCode,
    source: "ops",
    latitude: resolved.location.latitude,
    longitude: resolved.location.longitude,
    notes: "Activated by markets:activate",
  });
  await rememberIngestZipGeocode(resolved.location);

  console.log(
    `active_markets: ${zipCode} is active (${resolved.location.city}, ${resolved.location.state}). Cron will ingest this ZIP when YUM4LESS_INGEST_ZIPS is unset.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
