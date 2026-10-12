import { listIngestMarkets } from "@/lib/active-markets";
import { resetDbPoolForTests } from "@/lib/db";
import { loadEnvLocal } from "@/lib/load-env-local";
import { runAfterUpdateChecks } from "@/lib/owner/after-update-repository";
import { activateOwnerIngestMarket } from "@/lib/owner/ingest-markets";
import { buildOwnerMarketReach } from "@/lib/owner/market-reach-repository";
import {
  appendMorningIssue,
  composeMorningReport,
  isDiscordWebhookUrl,
  isMorningZipAddDay,
  mergeOffZipCounts,
  morningReportDate,
  morningWeekday,
  pickMorningZipCandidates,
  type ZipProbeOutcome,
} from "@/lib/owner/morning-report";
import {
  isMissingMorningReportSchema,
  listAddedZipCodes,
  listZipsWaitingForTest,
  readExternalCheck,
  recordZipAdd,
  recordZipTest,
  saveMorningReport,
} from "@/lib/owner/morning-report-repository";
import { probeShopperArea } from "@/lib/owner/morning-shopper-probe";

loadEnvLocal();

const APP_ORIGIN =
  process.env.YUM4LESS_MORNING_APP_ORIGIN?.trim() || "http://yum4less-app:3000";

async function postDiscord(body: string): Promise<{ ok: boolean }> {
  const url = process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL?.trim();
  if (!isDiscordWebhookUrl(url)) {
    return { ok: false };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: body.slice(0, 1800) }),
    signal: AbortSignal.timeout(8_000),
  });
  return { ok: response.ok };
}

export async function runMorningReport(): Promise<void> {
  if (process.env.YUM4LESS_MORNING_REPORT !== "1") {
    console.log(
      "Morning report skipped. The ingest cron sets YUM4LESS_MORNING_REPORT=1. A laptop run does not turn ZIPs on.",
    );
    return;
  }

  const reportDate = morningReportDate();
  const weekday = morningWeekday();
  const discordConfigured = isDiscordWebhookUrl(
    process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL,
  );
  const external = await readExternalCheck(reportDate).catch((error) => {
    if (isMissingMorningReportSchema(error)) {
      throw error;
    }
    return null;
  });
  const checks = await runAfterUpdateChecks(["last-night", "freshness"]);
  const lastNightOk = checks.find((check) => check.id === "last-night")?.ok === true;
  const pricesFresh = checks.find((check) => check.id === "freshness")?.ok === true;
  const markets = await listIngestMarkets();
  const active = markets.filter((market) => market.status === "active");
  const activeZipCodes = new Set(active.map((market) => market.zipCode));
  const alreadyAdded = await listAddedZipCodes();

  const zipResults: { zipCode: string; outcome: ZipProbeOutcome }[] = [];
  const waiting = await listZipsWaitingForTest(reportDate);
  for (const row of waiting) {
    if (!lastNightOk) {
      zipResults.push({ zipCode: row.zipCode, outcome: "waiting" });
      continue;
    }
    const market = active.find((item) => item.zipCode === row.zipCode);
    if (
      market?.latitude === null ||
      market?.latitude === undefined ||
      market.longitude === null ||
      market.longitude === undefined
    ) {
      zipResults.push({ zipCode: row.zipCode, outcome: "failed" });
      await recordZipTest({
        zipCode: row.zipCode,
        testedOn: reportDate,
        outcome: "failed",
      });
      continue;
    }
    const probe = await probeShopperArea({
      origin: APP_ORIGIN,
      latitude: market.latitude,
      longitude: market.longitude,
    });
    zipResults.push({ zipCode: row.zipCode, outcome: probe.outcome });
    await recordZipTest({
      zipCode: row.zipCode,
      testedOn: reportDate,
      outcome: probe.outcome,
    });
  }

  const addDay = isMorningZipAddDay(reportDate);
  const addedZipCodes: string[] = [];
  const addErrors: string[] = [];
  let addSkipped: "not-add-day" | "last-night" | "none-left" | null = null;
  let nearbyLeft = false;

  if (!addDay) {
    addSkipped = "not-add-day";
  } else if (!lastNightOk) {
    addSkipped = "last-night";
  } else {
    const groups: { zipCode: string; storeCount: number }[][] = [];
    for (const market of active) {
      const reach = await buildOwnerMarketReach(market.zipCode);
      if (reach.ok) {
        groups.push(
          reach.reach.offZips.map((zip) => ({
            zipCode: zip.zipCode,
            storeCount: zip.storeCount,
          })),
        );
      }
    }
    if (active.length > 0 && groups.length === 0) {
      addErrors.push("Nearby areas could not be listed.");
    } else {
    const offZips = mergeOffZipCounts(groups);
    const candidates = pickMorningZipCandidates({
      offZips,
      activeZipCodes,
      alreadyAdded,
    });
    nearbyLeft =
      offZips.filter(
        (zip) =>
          !activeZipCodes.has(zip.zipCode) && !alreadyAdded.has(zip.zipCode),
      ).length > candidates.length;
    if (candidates.length === 0) {
      addSkipped = "none-left";
      nearbyLeft = false;
    }
    for (const zipCode of candidates) {
      const activated = await activateOwnerIngestMarket(zipCode, {
        notes: "Activated by the morning job",
      });
      if (!activated.ok) {
        addErrors.push(`Could not add ${zipCode}. ${activated.error}`);
        continue;
      }
      addedZipCodes.push(zipCode);
      await recordZipAdd({ zipCode, addedOn: reportDate });
    }
    if (candidates.length > 0 && addedZipCodes.length === 0) {
      addSkipped = null;
    }
    }
  }

  let note = composeMorningReport({
    weekday,
    codeTests: external?.codeTests ?? "not_reported",
    siteCheck: external?.siteCheck ?? "not_reported",
    lastNightOk,
    pricesFresh,
    addDay,
    addedZipCodes,
    addSkipped,
    addErrors,
    zipResults,
    nearbyLeft,
    discordConfigured,
  });

  if (discordConfigured) {
    const posted = await postDiscord(note.body).catch(() => ({ ok: false }));
    if (!posted.ok) {
      note = appendMorningIssue(note, "Discord did not accept the note.");
    }
  }

  await saveMorningReport({
    reportDate,
    kind: "morning",
    body: note.body,
    needsAttention: note.needsAttention,
  });
  console.log(note.body);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }
  try {
    await runMorningReport();
  } finally {
    await resetDbPoolForTests();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Morning report crashed: ${message}`);
  process.exit(1);
});
