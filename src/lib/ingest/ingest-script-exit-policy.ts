export function shouldFailProviderPriceSyncExit(
  summaries: ReadonlyArray<{ failedCount: number }>,
): boolean {
  return summaries.some((summary) => summary.failedCount > 0);
}

export function shouldFailWeeklyAdIngestExit(input: {
  results: ReadonlyArray<{ status: string }>;
  syncSummaries: ReadonlyArray<{ failedCount: number }>;
}): boolean {
  if (input.syncSummaries.some((summary) => summary.failedCount > 0)) {
    return true;
  }

  return input.results.some((result) => result.status === "error");
}
