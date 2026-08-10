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

/** Clamp a query-string offset (0+). Invalid → 0. */
export function clampListOffset(raw: string | null): number {
  if (raw == null || raw.trim() === "") {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}
