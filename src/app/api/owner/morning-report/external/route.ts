import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { parseJsonBody } from "@/lib/api-request";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { postMorningDiscord } from "@/lib/owner/morning-discord";
import {
  isMissingMorningReportSchema,
  readMorningReport,
  saveExternalCheck,
  saveMorningReport,
} from "@/lib/owner/morning-report-repository";
import {
  appendMorningIssue,
  applyOutsideResultToMorningNote,
  isDiscordWebhookUrl,
  morningReportDate,
  outsideChecksAreReported,
  type MorningCheckState,
} from "@/lib/owner/morning-report";
import { publicApiErrorResponse } from "@/lib/public-api-error";

const STATES = new Set<MorningCheckState>(["passed", "failed", "not_reported"]);

export async function POST(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerMorningReport");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "The morning note needs a configured database." },
      { status: 503 },
    );
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ ok: false, error: parsedBody.error }, { status: 400 });
  }

  const body = parsedBody.body as {
    codeTests?: unknown;
    siteCheck?: unknown;
    detail?: unknown;
  };
  if (
    typeof body.codeTests !== "string" ||
    typeof body.siteCheck !== "string" ||
    !STATES.has(body.codeTests as MorningCheckState) ||
    !STATES.has(body.siteCheck as MorningCheckState)
  ) {
    return NextResponse.json(
      { ok: false, error: "The outside check result is invalid." },
      { status: 400 },
    );
  }

  const detail =
    typeof body.detail === "string" ? body.detail.trim().slice(0, 500) : "";

  const codeTests = body.codeTests as MorningCheckState;
  const siteCheck = body.siteCheck as MorningCheckState;

  try {
    const reportDate = morningReportDate();
    await saveExternalCheck({
      reportDate,
      codeTests,
      siteCheck,
      detail,
    });
    const existing = await readMorningReport(reportDate);
    if (existing) {
      const discordConfigured = isDiscordWebhookUrl(
        process.env.YUM4LESS_MORNING_DISCORD_WEBHOOK_URL,
      );
      let note = applyOutsideResultToMorningNote(existing.body, {
        codeTests,
        siteCheck,
        discordConfigured,
      });
      if (note.body !== existing.body) {
        if (discordConfigured && outsideChecksAreReported(codeTests, siteCheck)) {
          const posted = await postMorningDiscord(note.body).catch(() => ({ ok: false }));
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
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingMorningReportSchema(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "This database has no morning note yet. Apply db/init/039.",
        },
        { status: 503 },
      );
    }
    return publicApiErrorResponse(
      "api.owner.morning-report.external.POST",
      error,
      "The outside check could not be saved.",
    );
  }
}
