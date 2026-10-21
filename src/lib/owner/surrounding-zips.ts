import { listTouchingZipCodes } from "@/lib/geo/zcta-neighbors";

const ZIP5 = /^\d{5}$/;

/**
 * ZIP codes whose Census outline touches an active ZIP, excluding ZIPs
 * that are already on, paused, or previously added.
 */
export async function listSurroundingZipCodes(input: {
  activeZipCodes: readonly string[];
  blockedZipCodes: ReadonlySet<string>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; zipCodes: string[] } | { ok: false; error: string }> {
  const active = input.activeZipCodes.filter((zipCode) => ZIP5.test(zipCode));
  if (active.length === 0) {
    return { ok: true, zipCodes: [] };
  }

  const found = new Set<string>();
  let listed = 0;
  let lastError = "Surrounding areas could not be listed.";
  for (const zipCode of active) {
    const touching = await listTouchingZipCodes({
      zipCode,
      fetchImpl: input.fetchImpl,
    });
    if (!touching.ok) {
      lastError = touching.error;
      continue;
    }
    listed += 1;
    for (const neighbor of touching.zipCodes) {
      if (!input.blockedZipCodes.has(neighbor)) {
        found.add(neighbor);
      }
    }
  }

  if (listed === 0) {
    return { ok: false, error: lastError };
  }

  return {
    ok: true,
    zipCodes: [...found].sort((a, b) => a.localeCompare(b)),
  };
}
