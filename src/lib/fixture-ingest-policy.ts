import {
  isFixtureOsmCatalogSource,
  isFixtureOsmStoreId,
  OSM_MAP_FIXTURE_ID_PREFIX,
  OSM_MAP_FIXTURE_SOURCE,
} from "@/lib/osm-food-retail-discovery";

const FIXTURE_WEEKLY_AD_FLAG = "YUM4LESS_WEEKLY_AD_FIXTURE";
const FIXTURE_MAP_CATALOG_FLAG = "YUM4LESS_MAP_CATALOG_FIXTURE";

export type FixtureIngestDatabaseValidation =
  | { ok: true; databaseUrl: string }
  | { ok: false; error: string };

function normalizeDatabaseUrl(url: string | undefined) {
  return url?.trim() ?? "";
}

export function isFixtureIngestMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env[FIXTURE_WEEKLY_AD_FLAG] === "1" || env[FIXTURE_MAP_CATALOG_FLAG] === "1"
  );
}

function isCiRuntime(env: NodeJS.ProcessEnv) {
  const ci = env.CI?.trim().toLowerCase();
  return ci === "true" || ci === "1" || env.GITHUB_ACTIONS === "true";
}

function isTestRuntime(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV === "test";
}

export function validateFixtureIngestDatabasePolicy(
  env: NodeJS.ProcessEnv = process.env,
): FixtureIngestDatabaseValidation {
  if (!isFixtureIngestMode(env)) {
    return { ok: true, databaseUrl: normalizeDatabaseUrl(env.DATABASE_URL) };
  }

  if (isCiRuntime(env) || isTestRuntime(env)) {
    return { ok: true, databaseUrl: normalizeDatabaseUrl(env.DATABASE_URL) };
  }

  const testDatabaseUrl = normalizeDatabaseUrl(env.DATABASE_URL_TEST);
  const databaseUrl = normalizeDatabaseUrl(env.DATABASE_URL);

  if (!testDatabaseUrl) {
    return {
      ok: false,
      error: [
        "Fixture ingest refused: rehearsal flags cannot write to your dev database.",
        `Unset ${FIXTURE_WEEKLY_AD_FLAG} / ${FIXTURE_MAP_CATALOG_FLAG}, or set DATABASE_URL_TEST to a dedicated database`,
        "(for example postgresql://postgres:postgres@localhost:5433/yum4less_test)",
        "and point DATABASE_URL at the same URL before running fixture ingest.",
      ].join(" "),
    };
  }

  if (!databaseUrl || databaseUrl !== testDatabaseUrl) {
    return {
      ok: false,
      error: [
        "Fixture ingest refused: DATABASE_URL must match DATABASE_URL_TEST for rehearsal writes.",
        `DATABASE_URL_TEST=${testDatabaseUrl}`,
        databaseUrl
          ? `DATABASE_URL=${databaseUrl}`
          : "DATABASE_URL is not set.",
      ].join(" "),
    };
  }

  return { ok: true, databaseUrl: testDatabaseUrl };
}

/** Throws when fixture ingest flags target a non-test database outside CI/Vitest. */
export function enforceFixtureIngestDatabasePolicy(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const validation = validateFixtureIngestDatabasePolicy(env);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return validation.databaseUrl;
}

/** Assert a single map-catalog fixture row uses the distinct id/source contract. */
export function assertFixtureOsmCatalogIdentity(input: {
  id: string;
  sourceName: string;
}): void {
  if (!isFixtureOsmStoreId(input.id)) {
    throw new Error(
      `Fixture map-catalog write refused: store id must use ${OSM_MAP_FIXTURE_ID_PREFIX}* (got ${input.id}).`,
    );
  }

  if (!isFixtureOsmCatalogSource(input.sourceName)) {
    throw new Error(
      `Fixture map-catalog write refused: source_name must be ${OSM_MAP_FIXTURE_SOURCE} (got ${input.sourceName}).`,
    );
  }
}

/**
 * When map-catalog fixture mode is on, reject any OSM-style write that still
 * uses the live Overpass id/source namespace.
 */
export function enforceFixtureOsmCatalogWrites(
  stores: Array<{ id: string; sourceName: string }>,
  env: NodeJS.ProcessEnv = process.env,
  options?: { force?: boolean },
): void {
  if (!options?.force && env[FIXTURE_MAP_CATALOG_FLAG] !== "1") {
    return;
  }

  for (const store of stores) {
    const looksLikeOsmOrFixture =
      store.id.startsWith("osm-") ||
      store.id.startsWith(OSM_MAP_FIXTURE_ID_PREFIX) ||
      store.sourceName === "openstreetmap-overpass" ||
      isFixtureOsmCatalogSource(store.sourceName);

    if (!looksLikeOsmOrFixture) {
      continue;
    }

    assertFixtureOsmCatalogIdentity(store);
  }
}
