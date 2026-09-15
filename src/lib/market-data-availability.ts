import { NextResponse } from "next/server";
import { RecommendationDependencyUnavailableError } from "@/contracts/recommendations";

export type MarketDataSourceLike = {
  dataSource: "database" | "unavailable" | string;
};

/**
 * Shared empty-vs-unavailable gate for market-backed shopper reads.
 * Call after a market snapshot load — never treat Postgres outage as “no stores.”
 */
export function assertMarketDataAvailable(
  market: MarketDataSourceLike,
  message?: string,
): void {
  if (market.dataSource === "unavailable") {
    throw new RecommendationDependencyUnavailableError(message);
  }
}

/** HTTP 503 JSON for dependency / Postgres outages on public shopper APIs. */
export function dependencyUnavailableResponse(
  error: RecommendationDependencyUnavailableError | { message: string },
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: error.message,
    },
    { status: 503 },
  );
}

export function isDependencyUnavailableError(
  error: unknown,
): error is RecommendationDependencyUnavailableError {
  return error instanceof RecommendationDependencyUnavailableError;
}
