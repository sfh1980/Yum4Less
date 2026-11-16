import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT,
  GEOLOCATION_PROMPT_TIMEOUT_MS_ENV,
  readGeolocationPromptTimeoutMs,
  requestBrowserLocation,
} from "@/lib/geolocation-prompt";

describe("readGeolocationPromptTimeoutMs", () => {
  it("uses 12000 milliseconds when the setting is unset or out of range", () => {
    expect(readGeolocationPromptTimeoutMs({})).toBe(
      GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT,
    );
    expect(
      readGeolocationPromptTimeoutMs({
        [GEOLOCATION_PROMPT_TIMEOUT_MS_ENV]: "soon",
      }),
    ).toBe(GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT);
    expect(
      readGeolocationPromptTimeoutMs({
        [GEOLOCATION_PROMPT_TIMEOUT_MS_ENV]: "999",
      }),
    ).toBe(GEOLOCATION_PROMPT_TIMEOUT_MS_DEFAULT);
  });

  it("reads an in-range setting", () => {
    expect(
      readGeolocationPromptTimeoutMs({
        [GEOLOCATION_PROMPT_TIMEOUT_MS_ENV]: "8000",
      }),
    ).toBe(8_000);
  });
});

describe("requestBrowserLocation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops waiting when the browser never answers", () => {
    vi.useFakeTimers();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const getCurrentPosition = vi.fn();

    requestBrowserLocation({
      onSuccess,
      onFailure,
      timeoutMs: 40,
      geolocation: { getCurrentPosition } as unknown as Geolocation,
    });

    expect(onFailure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(40);
    expect(onFailure).toHaveBeenCalledWith("timeout");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
