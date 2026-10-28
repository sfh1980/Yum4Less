import { getDbPool } from "@/lib/db";
import { parseIngestZipOverlay } from "@/lib/ingest-zip-codes";
import { queryRankedPriceFreshness } from "@/lib/ingest/ingest-freshness-heartbeat";
import { isDependencyUnavailableError } from "@/lib/market-data-availability";
import { loadChainMembership } from "@/lib/chain-membership-repository";
import type { ResolvedSearchLocation } from "@/lib/location-resolution";
import { getRecommendationExperience } from "@/lib/recommendation-service";
import {
  AFTER_UPDATE_CHECK_IDS,
  AFTER_UPDATE_SHOPPER_PIN,
  judgeFreshness,
  judgeLastNight,
  judgeMarkets,
  judgeMigrations,
  judgeRankedBanners,
  judgeShopperRead,
  type AfterUpdateCheckId,
  type AfterUpdateCheckResult,
  type LastNightJob,
} from "@/lib/owner/after-update-checks";
import { EXPECTED_MIGRATION_FILENAMES } from "@/lib/owner/expected-migration-files";

const CHECK_ORDER = new Map<AfterUpdateCheckId, number>(
  AFTER_UPDATE_CHECK_IDS.map((id, index) => [id, index]),
);

function isMissingRelation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

function formatRunDate(value: Date | string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function failed(
  id: AfterUpdateCheckId,
  detail: string,
): AfterUpdateCheckResult {
  const titles: Record<AfterUpdateCheckId, string> = {
    migrations: "Database updates",
    markets: "ZIP list",
    "last-night": "Last night",
    freshness: "Recent prices",
    "ranked-banners": "Ranked chains",
    "shopper-read": "One shopper search",
  };
  return { id, title: titles[id], ok: false, detail };
}

async function loadMigrations(): Promise<AfterUpdateCheckResult> {
  try {
    const result = await getDbPool().query<{ filename: string }>(
      "select filename from schema_migrations order by version",
    );
    return judgeMigrations({
      expectedFilenames: EXPECTED_MIGRATION_FILENAMES,
      appliedFilenames: result.rows.map((row) => row.filename),
    });
  } catch (error) {
    if (isMissingRelation(error)) {
      return judgeMigrations({
        expectedFilenames: EXPECTED_MIGRATION_FILENAMES,
        appliedFilenames: null,
      });
    }
    throw error;
  }
}

async function loadMarkets(): Promise<AfterUpdateCheckResult> {
  let overlayActive = false;
  try {
    overlayActive = parseIngestZipOverlay().length > 0;
  } catch {
    overlayActive = true;
  }

  try {
    const result = await getDbPool().query<{
      zip_code: string;
      latitude: string | number | null;
      longitude: string | number | null;
    }>(
      `
        select zip_code, latitude, longitude
        from active_markets
        where status = 'active'
        order by zip_code
      `,
    );
    return judgeMarkets({
      overlayActive,
      markets: result.rows.map((row) => ({
        zipCode: row.zip_code.trim(),
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
      })),
    });
  } catch (error) {
    if (isMissingRelation(error)) {
      return failed("markets", "This database has no ZIP table yet.");
    }
    throw error;
  }
}

async function queryLatestIngestJobs(): Promise<LastNightJob[]> {
  const result = await getDbPool().query<{
    run_date: Date | string;
    kind: string;
    status: string;
    last_error: string | null;
  }>(
    `
      select run_date, kind, status, last_error
      from ingest_jobs
      where run_date = (select max(run_date) from ingest_jobs)
      order by kind
    `,
  );
  return result.rows.map((row) => ({
    kind: row.kind,
    status: row.status,
    lastError: row.last_error,
  }));
}

export async function loadLatestIngestJobs(): Promise<LastNightJob[] | null> {
  try {
    return await queryLatestIngestJobs();
  } catch (error) {
    if (isMissingRelation(error)) {
      return null;
    }
    throw error;
  }
}

async function loadLastNight(): Promise<AfterUpdateCheckResult> {
  try {
    const jobs = await queryLatestIngestJobs();
    const runDateResult = await getDbPool().query<{ run_date: Date | string }>(
      `select max(run_date) as run_date from ingest_jobs`,
    );
    return judgeLastNight({
      runDate: formatRunDate(runDateResult.rows[0]?.run_date),
      jobs,
    });
  } catch (error) {
    if (isMissingRelation(error)) {
      return judgeLastNight({ runDate: null, jobs: null });
    }
    throw error;
  }
}

async function loadFreshness(): Promise<AfterUpdateCheckResult> {
  const report = await queryRankedPriceFreshness(getDbPool());
  return judgeFreshness(report);
}

async function loadRankedBanners(): Promise<AfterUpdateCheckResult> {
  const membership = await loadChainMembership();
  return judgeRankedBanners(membership.shopperRankedChainIds);
}

async function loadShopperRead(): Promise<AfterUpdateCheckResult> {
  const location: ResolvedSearchLocation = {
    city: "Mechanicsville",
    state: "VA",
    latitude: AFTER_UPDATE_SHOPPER_PIN.latitude,
    longitude: AFTER_UPDATE_SHOPPER_PIN.longitude,
    source: "browser",
  };

  try {
    const experience = await getRecommendationExperience(
      {
        zipCode: "",
        radiusMiles: 8,
        budget: 40,
        maxIngredients: 15,
        shoppingStyle: "single-store",
        dietaryFocus: "anything",
        recipeSource: "themealdb",
        selectedStoreIds: [],
      },
      location,
      Boolean(process.env.GEOCODIO_API_KEY?.trim()),
    );
    const notices = [
      experience.shopperNotice,
      ...(experience.supplementaryShopperNotices ?? []),
    ].filter((notice) => notice !== undefined);
    const trustText = [
      ...experience.recommendations.flatMap((meal) => [
        meal.title,
        meal.confidenceLabel,
        meal.freshnessLabel,
        meal.explanation,
      ]),
      ...notices.flatMap((notice) => [notice.title, notice.body]),
    ].join(" ");
    return judgeShopperRead({
      unavailable: false,
      recommendationCount: experience.recommendations.length,
      trustText,
    });
  } catch (error) {
    if (isDependencyUnavailableError(error)) {
      return judgeShopperRead({
        unavailable: true,
        errorMessage: error.message,
        recommendationCount: 0,
        trustText: "",
      });
    }
    throw error;
  }
}

const LOADERS: Record<AfterUpdateCheckId, () => Promise<AfterUpdateCheckResult>> = {
  migrations: loadMigrations,
  markets: loadMarkets,
  "last-night": loadLastNight,
  freshness: loadFreshness,
  "ranked-banners": loadRankedBanners,
  "shopper-read": loadShopperRead,
};

export async function runAfterUpdateChecks(
  requested: readonly AfterUpdateCheckId[] = AFTER_UPDATE_CHECK_IDS,
): Promise<AfterUpdateCheckResult[]> {
  const ids = [...new Set(requested)].sort(
    (left, right) => (CHECK_ORDER.get(left) ?? 0) - (CHECK_ORDER.get(right) ?? 0),
  );
  const checks = await Promise.all(
    ids.map(async (id) => {
      try {
        return await LOADERS[id]();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Check failed.";
        return failed(id, message);
      }
    }),
  );
  return checks;
}
