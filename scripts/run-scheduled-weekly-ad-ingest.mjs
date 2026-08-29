import {
  spawnNodeScript,
  spawnNpm,
  spawnNpx,
} from "./lib/spawn-safe.mjs";

console.log(`[${new Date().toISOString()}] Starting scheduled Yum4Less pricing ingest...`);

const useFixture = process.argv.includes("--fixture");
const weeklyOnly = process.argv.includes("--weekly-only");
const providerOnly = process.argv.includes("--provider-only");

if (useFixture) {
  process.env.YUM4LESS_WEEKLY_AD_FIXTURE = "1";
  process.env.YUM4LESS_MAP_CATALOG_FIXTURE = "1";
  const guard = spawnNpx(
    ["tsx", "scripts/enforce-fixture-ingest-database-policy.ts"],
    { env: process.env },
  );

  if (guard.status !== 0) {
    process.exit(guard.status ?? 1);
  }
}

if (!useFixture && !weeklyOnly && !providerOnly) {
  const envCheck = spawnNpx(["tsx", "scripts/assert-live-ingest-env.ts"], {
    env: process.env,
  });

  if (envCheck.status !== 0) {
    if (envCheck.error) {
      console.error(
        `[${new Date().toISOString()}] Live ingest env check failed to run:`,
        envCheck.error.message,
      );
    }
    process.exit(envCheck.status ?? 1);
  }
}

const ensure = spawnNodeScript("scripts/ensure-test-db.mjs", [], {
  env: process.env,
});

if (ensure.status !== 0) {
  console.error("Scheduled ingest failed while preparing Postgres.");
  process.exit(ensure.status ?? 1);
}

if (!weeklyOnly && !providerOnly) {
  const enqueue = spawnNpx(["tsx", "scripts/enqueue-scheduled-ingest.ts"], {
    env: process.env,
  });
  if (enqueue.status !== 0) {
    console.warn(
      `[${new Date().toISOString()}] Ingest job enqueue failed (apply db/init/029 if ingest_jobs is missing). Continuing inline pipeline.`,
    );
  } else if (process.env.YUM4LESS_INGEST_QUEUE_WORKER === "1") {
    console.log(
      `[${new Date().toISOString()}] YUM4LESS_INGEST_QUEUE_WORKER=1 — 3am enqueue only. Drain with npm run ingest:worker.`,
    );
    process.exit(0);
  }
}

// Step order: map-catalog → weekly-ad → snap-ensure → provider-sync → themealdb-from-sales → ranked-price-freshness
// (see src/lib/scheduled-ingest-pipeline.ts + unit test)

if (!weeklyOnly && !providerOnly) {
  const mapCatalog = useFixture
    ? spawnNpm(["run", "ingest:map-catalog:fixture"], { env: process.env })
    : spawnNpm(["run", "ingest:map-catalog"], { env: process.env });

  if (mapCatalog.status !== 0) {
    console.warn(
      `[${new Date().toISOString()}] Map catalog step failed (often OSM Overpass timeout). Continuing weekly-ad + provider sync.`,
    );
    console.warn(
      "Check YUM4LESS_OSM_OVERPASS_URL or Overpass logs above. OSM context pins and Aldi ranked catalog may be missing until the next run.",
    );
  }
}

const weeklyAdArgs = useFixture ? ["--fixture"] : [];

if (!providerOnly) {
  const ingest = spawnNodeScript("scripts/run-weekly-ad-ingest.mjs", weeklyAdArgs, {
    env: process.env,
  });

  if (ingest.status !== 0) {
    console.error("Scheduled ingest failed during weekly-ad pull.");
    process.exit(ingest.status ?? 1);
  }
}

if (!weeklyOnly) {
  const snapEnsure = spawnNodeScript("scripts/ensure-snap-context.mjs", ["--quiet"], {
    env: process.env,
  });

  if (snapEnsure.status !== 0) {
    console.warn(
      `[${new Date().toISOString()}] SNAP auto-ensure failed (non-fatal when YUM4LESS_MAP_SNAP_CONTEXT=1).`,
    );
  }
}

if (!weeklyOnly && !useFixture) {
  const providerSync = spawnNpm(["run", "sync:provider-prices"], {
    env: process.env,
  });

  if (providerSync.status !== 0) {
    console.error("Scheduled ingest failed during provider price sync.");
    process.exit(providerSync.status ?? 1);
  }

  const themealdbImport = spawnNpm(["run", "ingest:themealdb:from-sales"], {
    env: process.env,
  });

  if (themealdbImport.status !== 0) {
    console.error("Scheduled ingest failed during TheMealDB sale-driven import.");
    process.exit(themealdbImport.status ?? 1);
  }
}

const freshness = spawnNpm(["run", "check:ranked-price-freshness"], {
  env: process.env,
});

if (freshness.status !== 0) {
  console.error(
    "Scheduled ingest failed ranked-price freshness heartbeat (0 fresh observations in 24h, or check crashed).",
  );
  process.exit(freshness.status ?? 1);
}

console.log(`[${new Date().toISOString()}] Scheduled pricing ingest completed.`);
