/**
 * How long the shopper waits on a browser location prompt before we stop
 * and offer a ZIP code. Read on the server and passed into the wizard.
 * Unset, or a value outside 1000–60000, uses 12000 milliseconds.
 */
export const GEOLOCATION_PROMPT_TIMEOUT_MS_ENV =
  "YUM4LESS_GEOLOCATION_TIMEOUT_MS";

export const GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT = 12_000;

export const GPS_PROMPT_TIMED_OUT_NOTICE =
  "Location is taking too long. Use a ZIP code instead.";

export const GPS_PROMPT_TIMED_OUT_SAVED_ZIP_NOTICE =
  "Location is taking too long — using your saved ZIP instead.";

export type GeolocationPromptFailure = "denied" | "timeout" | "unavailable";

export function readGeolocationPromptTimeoutMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[GEOLOCATION_PROMPT_TIMEOUT_MS_ENV]?.trim();
  if (!raw) {
    return GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 60_000) {
    return GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT;
  }

  return parsed;
}

export function requestBrowserLocation(input: {
  onSuccess: (position: GeolocationPosition) => void;
  onFailure: (reason: GeolocationPromptFailure) => void;
  timeoutMs?: number;
  geolocation?: Geolocation;
}): () => void {
  const timeoutMs = input.timeoutMs ?? readGeolocationPromptTimeoutMs();
  const geo =
    input.geolocation ??
    (typeof navigator !== "undefined" ? navigator.geolocation : undefined);
  let settled = false;

  const timer = globalThis.setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    input.onFailure("timeout");
  }, timeoutMs);

  const finish = (run: () => void) => {
    if (settled) {
      return;
    }
    settled = true;
    globalThis.clearTimeout(timer);
    run();
  };

  if (!geo) {
    finish(() => input.onFailure("unavailable"));
    return () => {
      settled = true;
      globalThis.clearTimeout(timer);
    };
  }

  geo.getCurrentPosition(
    (position) => finish(() => input.onSuccess(position)),
    (error) =>
      finish(() => {
        if (error.code === error.TIMEOUT) {
          input.onFailure("timeout");
          return;
        }
        if (error.code === error.PERMISSION_DENIED) {
          input.onFailure("denied");
          return;
        }
        input.onFailure("unavailable");
      }),
    { timeout: timeoutMs, maximumAge: 0 },
  );

  return () => {
    settled = true;
    globalThis.clearTimeout(timer);
  };
}
