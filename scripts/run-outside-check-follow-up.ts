import { resetDbPoolForTests } from "@/lib/db";
import { loadEnvLocal } from "@/lib/load-env-local";
import { postMorningDiscord } from "@/lib/owner/morning-discord";
import {
  isDiscordWebhookUrl,
  morningReportDate,
  planOutsideCheckFollowUp,
  readOutsideCheckCutoff,
} from "@/lib/owner/morning-report";
import {
  readExternalCheck,
  readMorningReport,
  saveMorningReport,
} from "@/lib/owner/morning-report-repository";

loadEnvLocal();

async function main() {
  if (process.env.YUM4LESS_MORNING_REPORT !== "1") {
    console.log(
      "Outside-check follow-up skipped. The ingest cron sets YUM4LESS_MORNING_REPORT=1.",
    );
    return;
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
  }

  const reportDate = morningReportDate();
  const external = await readExternalCheck(reportDate);
  const note = await readMorningReport(reportDate);
  const discordConfigured = isDiscordWebhookUrl(
    process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL,
  );
  const plan = planOutsideCheckFollowUp({
    now: new Date(),
    cutoff: readOutsideCheckCutoff(),
    external,
    noteBody: note?.body ?? null,
    discordConfigured,
  });
  if (plan.action === "none") {
    console.log(`Outside-check follow-up: ${plan.reason}.`);
    return;
  }

  await saveMorningReport({
    reportDate,
    kind: "morning",
    body: plan.body,
    needsAttention: true,
  });
  if (discordConfigured) {
    const posted = await postMorningDiscord(plan.body).catch(() => ({ ok: false }));
    if (!posted.ok) {
      console.error("Discord did not accept the outside-check alert.");
    }
  }
  console.log(plan.body);
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Outside-check follow-up crashed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await resetDbPoolForTests().catch(() => undefined);
  });
