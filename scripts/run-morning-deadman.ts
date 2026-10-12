import { resetDbPoolForTests } from "@/lib/db";
import { loadEnvLocal } from "@/lib/load-env-local";
import {
  composeMissedMorningReport,
  isDiscordWebhookUrl,
  morningReportDate,
  morningWeekday,
} from "@/lib/owner/morning-report";
import {
  hasMorningReport,
  saveMorningReport,
} from "@/lib/owner/morning-report-repository";

loadEnvLocal();

async function postDiscord(body: string): Promise<void> {
  const url = process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL?.trim();
  if (!isDiscordWebhookUrl(url)) {
    console.error("Morning check did not run, and the Discord webhook is not set.");
    return;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: body.slice(0, 1800) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error(`Discord returned ${response.status}.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main() {
  if (process.env.YUM4LESS_MORNING_REPORT !== "1") {
    console.log("Morning dead-man skipped. The ingest cron sets YUM4LESS_MORNING_REPORT=1.");
    return;
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const reportDate = morningReportDate();
  const present = await hasMorningReport(reportDate);
  if (present) {
    console.log("Morning note is already stored.");
    return;
  }

  const note = composeMissedMorningReport(morningWeekday());
  await saveMorningReport({
    reportDate,
    kind: "missed",
    body: note.body,
    needsAttention: true,
  });
  await postDiscord(note.body);
  console.log(note.body);
}

main()
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Morning dead-man crashed: ${message}`);
    await postDiscord(composeMissedMorningReport(morningWeekday()).body);
    process.exitCode = 1;
  })
  .finally(async () => {
    await resetDbPoolForTests().catch(() => undefined);
  });
