/** Clamp a query-string list limit for owner/admin list APIs. */
export function clampListLimit(
  raw: string | null,
  defaultLimit: number,
  maxLimit = 100,
): number {
  if (raw == null || raw.trim() === "") {
    return defaultLimit;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return defaultLimit;
  }

  return Math.min(maxLimit, Math.max(1, Math.floor(parsed)));
}
