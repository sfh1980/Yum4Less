import { NextResponse } from "next/server";
import { enforceApiRateLimit, rateLimitResponse } from "@/lib/api-rate-limit";
import { isFeedbackListAuthorized } from "@/lib/feedback/feedback-admin-auth";
import { clampListLimit, clampListOffset } from "@/lib/list-limit";
import {
  listStoreCoverage,
  STORE_COVERAGE_LIMITS,
} from "@/lib/owner/store-coverage-repository";
import type { StoreCoverageUsableFilter } from "@/lib/owner/store-coverage";
import { publicApiErrorResponse } from "@/lib/public-api-error";

function parseUsable(raw: string | null): StoreCoverageUsableFilter {
  if (raw === "yes" || raw === "no") {
    return raw;
  }
  return "all";
}

function isMissingCoverageSchema(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /chain_registry|store_coverage/i.test(message);
}

export async function GET(request: Request) {
  const rateLimit = enforceApiRateLimit(request, "apiOwnerStoreCoverage");
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit);
  }

  if (!isFeedbackListAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: "Store coverage needs a configured database." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const limit = clampListLimit(
    url.searchParams.get("limit"),
    STORE_COVERAGE_LIMITS.default,
    STORE_COVERAGE_LIMITS.max,
  );
  const offset = clampListOffset(url.searchParams.get("offset"));

  try {
    const result = await listStoreCoverage({
      nameQuery: url.searchParams.get("name") ?? url.searchParams.get("q") ?? undefined,
      locationQuery: url.searchParams.get("location") ?? undefined,
      usable: parseUsable(url.searchParams.get("usable")),
      limit,
      offset,
    });
    return NextResponse.json({
      ok: true,
      stores: result.stores,
      summaries: result.summaries,
      freshnessHours: result.freshnessHours,
      hasMore: result.hasMore,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    const migrateMessage =
      "Store coverage could not be loaded. Apply db/init/026 if chain_registry is missing.";
    if (isMissingCoverageSchema(error)) {
      return NextResponse.json({ ok: false, error: migrateMessage }, { status: 503 });
    }
    return publicApiErrorResponse("api.owner.store-coverage.GET", error, migrateMessage);
  }
}
