/**
 * Shopper UI hides internal diagnostics by default.
 * Set NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS=1 locally to surface the dev link.
 */
export function isInternalDetailsUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_YUM4LESS_SHOW_INTERNAL_DETAILS === "1";
}
