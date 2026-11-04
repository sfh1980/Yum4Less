/**
 * Log-only look at Flipp flyer documents.
 * The merchant search and the flyer_id search still write the prices.
 * This path writes nothing. It stays off unless YUM4LESS_FLIPP_FLYER_DOCUMENT_LOG=1.
 */

import {
  fetchFlippFlyerSummaries,
  type FlippFlyerSummary,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import {
  classifyFlippFlyerDocument,
  fetchFlippFlyerDocument,
  type FlippFlyerDocumentClassification,
} from "@/lib/weekly-ad-ingestion/flipp-flyer-document";

export const FLIPP_FLYER_DOCUMENT_LOG_ENV = "YUM4LESS_FLIPP_FLYER_DOCUMENT_LOG";

type ListedFlyer = FlippFlyerSummary & {
  valid_from?: string | null;
  valid_to?: string | null;
  available_to?: string | null;
};

type FlyerWindow = "current" | "upcoming" | "ended" | "undated";

type GroupedFlyer = {
  flyerId: number;
  merchant: string;
  categories?: string[];
  categoriesCsv?: string;
  validFrom?: string;
  validTo?: string;
  availableTo?: string;
  window: FlyerWindow;
  zipCodes: string[];
};

export function flippFlyerDocumentLogEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[FLIPP_FLYER_DOCUMENT_LOG_ENV] === "1";
}

export async function logFlippFlyerDocumentPreview(input: {
  zipCodes: readonly string[];
  fetchImpl?: typeof fetch;
  now?: Date;
  log?: (line: string) => void;
}): Promise<string[]> {
  const now = input.now ?? new Date();
  const log = input.log ?? ((line: string) => console.info(line));
  const fetchImpl = input.fetchImpl;
  const groups = new Map<number, GroupedFlyer>();

  for (const zipCode of input.zipCodes) {
    const flyers = (await fetchFlippFlyerSummaries({
      zipCode,
      fetchImpl,
    })) as ListedFlyer[];
    for (const flyer of flyers) {
      if (typeof flyer.id !== "number") {
        continue;
      }
      const existing = groups.get(flyer.id);
      if (existing) {
        if (!existing.zipCodes.includes(zipCode)) {
          existing.zipCodes.push(zipCode);
        }
        continue;
      }
      groups.set(flyer.id, {
        flyerId: flyer.id,
        merchant: flyer.merchant?.trim() || "unknown",
        categories: flyer.categories,
        categoriesCsv: flyer.categories_csv,
        validFrom: flyer.valid_from?.trim() || undefined,
        validTo: flyer.valid_to?.trim() || undefined,
        availableTo: flyer.available_to?.trim() || undefined,
        window: flyerWindow(flyer, now),
        zipCodes: [zipCode],
      });
    }
  }

  const lines: string[] = [];
  const header = `[flipp-document] lists=${input.zipCodes.length} distinctFlyers=${groups.size}`;
  lines.push(header);
  log(header);

  for (const group of [...groups.values()].sort((left, right) => left.flyerId - right.flyerId)) {
    const line = await previewOneFlyer({ group, fetchImpl, log });
    lines.push(line);
  }

  return lines;
}

async function previewOneFlyer(input: {
  group: GroupedFlyer;
  fetchImpl?: typeof fetch;
  log: (line: string) => void;
}): Promise<string> {
  const { group } = input;
  if (group.window === "ended") {
    return emit(input.log, describeFlyer(group, { reason: "ended" }));
  }

  const listed = classifyFlippFlyerDocument({
    document: { items: [] },
    categories: group.categories,
    categoriesCsv: group.categoriesCsv,
  });
  if (listed.categoryKind === "general-merchandise") {
    return emit(input.log, describeFlyer(group, { reason: "general-merchandise" }));
  }

  const fetched = await fetchFlippFlyerDocument({
    flyerId: group.flyerId,
    postalCode: group.zipCodes[0] ?? "",
    categories: group.categories,
    categoriesCsv: group.categoriesCsv,
    fetchImpl: input.fetchImpl,
  });
  const classification = fetched.classification;
  return emit(
    input.log,
    describeFlyer(group, {
      reason: classification.kind,
      classification,
      itemCount: fetched.itemCount,
      pricedCount: fetched.offers.length,
    }),
  );
}

function emit(log: (line: string) => void, line: string): string {
  log(line);
  return line;
}

function describeFlyer(
  group: GroupedFlyer,
  detail: {
    reason: string;
    classification?: FlippFlyerDocumentClassification;
    pricedCount?: number;
    itemCount?: number;
  },
): string {
  const crossCheck = detail.classification
    ? detail.classification.crossCheckAgrees
      ? "agree"
      : `disagree name=${detail.classification.nameKind}`
    : "not-fetched";
  const items = detail.itemCount === undefined ? "" : `items=${detail.itemCount}`;
  const priced =
    detail.pricedCount === undefined ? "" : `priced=${detail.pricedCount}`;
  const available = group.availableTo ? ` availableTo=${group.availableTo}` : "";
  return [
    "[flipp-document]",
    `id=${group.flyerId}`,
    `merchant=${group.merchant}`,
    `window=${group.window}`,
    `decision=${detail.reason}`,
    `crossCheck=${crossCheck}`,
    items,
    priced,
    `validFrom=${group.validFrom ?? "none"}`,
    `validTo=${group.validTo ?? "none"}${available}`,
    `zips=${group.zipCodes.join(",")}`,
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}

function flyerWindow(flyer: ListedFlyer, now: Date): FlyerWindow {
  const from = instant(flyer.valid_from);
  const to = instant(flyer.valid_to);
  if (from === null && to === null) {
    return "undated";
  }
  const at = now.getTime();
  if (from !== null && from > at) {
    return "upcoming";
  }
  if (to !== null && to < at) {
    return "ended";
  }
  return "current";
}

function instant(value: string | null | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
