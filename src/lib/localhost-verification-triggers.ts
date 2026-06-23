/** Localhost-only hooks for agent/browser verification of error boundaries (H11). */
export function throwIfLocalhostVerificationRenderErrorRequested() {
  if (typeof window === "undefined") {
    return;
  }

  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    return;
  }

  if (new URLSearchParams(window.location.search).get("verifyRenderError") !== "1") {
    return;
  }

  throw new Error("Forced render error for error-boundary verification");
}
