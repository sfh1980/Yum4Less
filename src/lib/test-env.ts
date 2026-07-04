import { vi } from "vitest";

/** Prefer over direct `process.env.NODE_ENV =` — NODE_ENV is readonly under strict TS. */
export function stubTestNodeEnv(value: string) {
  vi.stubEnv("NODE_ENV", value);
}

export function restoreTestNodeEnv(original: string | undefined) {
  if (original === undefined) {
    vi.unstubAllEnvs();
    return;
  }

  vi.stubEnv("NODE_ENV", original);
}
