import { logServerError } from "@/lib/server-log";
import { listActiveMarketZipCodes } from "@/lib/active-markets";

const ZIP5 = /^\d{5}$/;

export const INGEST_ZIPS_REQUIRED_MESSAGE =
  "No ingest markets. Insert at least one active row in active_markets (npm run markets:activate -- <ZIP>) or set YUM4LESS_INGEST_ZIPS as a debug overlay. Optional single-ZIP alias: YUM4LESS_PROVIDER_SYNC_ZIP. There is no default market ZIP.";

export class IngestZipCodesRequiredError extends Error {
  constructor(message = INGEST_ZIPS_REQUIRED_MESSAGE) {
    super(message);
    this.name = "IngestZipCodesRequiredError";
  }
}

function parseZipList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((zip) => zip.trim())
    .filter((zip) => ZIP5.test(zip));
}

/**
 * Env overlay only. Never invents a geography (including 23111).
 * `YUM4LESS_PROVIDER_SYNC_ZIP` is an explicit single-ZIP alias only when the
 * multi-ZIP list is unset or blank — not a silent fallback for invalid lists.
 */
export function parseIngestZipCodesFromEnv(
  value = process.env.YUM4LESS_INGEST_ZIPS,
  syncZip = process.env.YUM4LESS_PROVIDER_SYNC_ZIP,
): string[] {
  const overlay = parseIngestZipOverlay(value, syncZip);
  if (overlay.length > 0) {
    return overlay;
  }

  throw new IngestZipCodesRequiredError();
}

/** Valid overlay ZIPs, or empty when env is unset. Throws if the list is present but invalid. */
export function parseIngestZipOverlay(
  value = process.env.YUM4LESS_INGEST_ZIPS,
  syncZip = process.env.YUM4LESS_PROVIDER_SYNC_ZIP,
): string[] {
  const fromList = parseZipList(value);
  if (fromList.length > 0) {
    return fromList;
  }

  if (value?.trim()) {
    throw new IngestZipCodesRequiredError(
      `YUM4LESS_INGEST_ZIPS had no valid 5-digit ZIP codes. ${INGEST_ZIPS_REQUIRED_MESSAGE}`,
    );
  }

  return parseZipList(syncZip);
}

export function mergeIngestZipSources(input: {
  overlayZips: string[];
  databaseZips: string[];
}): string[] {
  if (input.overlayZips.length > 0) {
    return input.overlayZips;
  }

  if (input.databaseZips.length > 0) {
    return input.databaseZips;
  }

  throw new IngestZipCodesRequiredError();
}

/**
 * Scheduled ingest markets: env overlay wins when set; otherwise active_markets.
 * Empty overlay + empty table fails closed. Never invents 23111.
 */
export async function resolveScheduledIngestZipCodes(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const overlayZips = parseIngestZipOverlay(
    env.YUM4LESS_INGEST_ZIPS,
    env.YUM4LESS_PROVIDER_SYNC_ZIP,
  );

  if (overlayZips.length > 0) {
    console.info(
      `[ingest-markets] Using env overlay (${overlayZips.length} ZIP(s)); active_markets not consulted this run.`,
    );
    return overlayZips;
  }

  try {
    const databaseZips = await listActiveMarketZipCodes();
    return mergeIngestZipSources({ overlayZips, databaseZips });
  } catch (error) {
    if (error instanceof IngestZipCodesRequiredError) {
      throw error;
    }

    logServerError("ingest-zip-codes.resolveScheduledIngestZipCodes", error);
    throw new IngestZipCodesRequiredError(
      `Could not read active_markets. Apply db/init/025 (npm run db:migrate) or set YUM4LESS_INGEST_ZIPS. ${INGEST_ZIPS_REQUIRED_MESSAGE}`,
    );
  }
}

/** Owner probes: singular `YUM4LESS_INGEST_ZIP`, else env overlay. Does not read active_markets. */
export function resolveRequiredProbeZipCode(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const singular = env.YUM4LESS_INGEST_ZIP?.trim();
  if (singular && ZIP5.test(singular)) {
    return singular;
  }

  const overlay = parseIngestZipOverlay(
    env.YUM4LESS_INGEST_ZIPS,
    env.YUM4LESS_PROVIDER_SYNC_ZIP,
  );
  if (overlay.length > 0) {
    return overlay[0]!;
  }

  throw new IngestZipCodesRequiredError();
}
