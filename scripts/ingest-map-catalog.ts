import { loadEnvLocal } from "@/lib/load-env-local";
import {
  parseIngestZipCodesFromEnv,
  syncUniversalMapCatalogForZip,
} from "@/lib/store-catalog-sync";

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const useFixture =
    process.argv.includes("--fixture") ||
    process.env.YUM4LESS_MAP_CATALOG_FIXTURE === "1";
  const zipCodes = parseIngestZipCodesFromEnv();
  let totalOsmUpserted = 0;
  let totalRankedUpserted = 0;
  let totalPublixUpserted = 0;

  for (const zipCode of zipCodes) {
    const result = await syncUniversalMapCatalogForZip({
      zipCode,
      useFixture,
    });

    totalOsmUpserted += result.osmUpserted;
    totalRankedUpserted += result.rankedUpserted;
    totalPublixUpserted += result.publixUpserted;

    console.log(
      `[map-catalog:${zipCode}] osm=${result.osmUpserted}, ranked=${result.rankedUpserted}, publix=${result.publixUpserted}`,
    );
    console.log(`  ${result.osmMessage}`);
    if (result.publixMessage) {
      console.log(`  ${result.publixMessage}`);
    }
  }

  console.log(
    `Map catalog ingest finished for ${zipCodes.length} ZIP(s); ${totalOsmUpserted} OSM map-context row(s), ${totalRankedUpserted} ranked chain row(s), ${totalPublixUpserted} Publix locator context row(s).`,
  );

  if (useFixture) {
    console.log(
      "Fixture mode: deterministic OSM-style stores only (npm run ingest:map-catalog:fixture).",
    );
  } else {
    console.log(
      "Live mode uses OSM Overpass (respect 1 req/s; daily cron only — not user search).",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
