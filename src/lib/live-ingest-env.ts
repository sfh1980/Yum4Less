const LIVE_INGEST_REQUIRED_ENV_KEYS = [
  "GEOCODIO_API_KEY",
  "KROGER_CLIENT_ID",
  "KROGER_CLIENT_SECRET",
] as const;

export type LiveIngestEnvKey = (typeof LIVE_INGEST_REQUIRED_ENV_KEYS)[number];

export type LiveIngestEnvValidation = {
  ok: boolean;
  missing: LiveIngestEnvKey[];
};

export function validateLiveIngestEnv(
  env: NodeJS.ProcessEnv = process.env,
): LiveIngestEnvValidation {
  const missing = LIVE_INGEST_REQUIRED_ENV_KEYS.filter(
    (key) => !env[key]?.trim(),
  );

  return {
    ok: missing.length === 0,
    missing: [...missing],
  };
}

export function formatLiveIngestEnvError(
  validation: LiveIngestEnvValidation,
): string {
  return [
    `Live scheduled ingest requires ${validation.missing.join(", ")} in .env.local (or environment).`,
    "Set keys from .env.example, then rerun: npm run ingest:weekly-ads:scheduled",
    "CI/rehearsal fixture path (no live keys): npm run ingest:weekly-ads:scheduled:fixture",
  ].join(" ");
}
