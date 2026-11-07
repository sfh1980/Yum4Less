/**
 * When the Publix store page is thin, fill from the Flipp flyer document
 * for this ZIP. The flyer id comes from that ZIP's own flyers list.
 * A flyer whose name says Charlotte is not fetched. Ids are not hardcoded.
 */

import {
  buildFlippFlyerDocumentUrl,
  parseFlippFlyerDocument,
  type FlippFlyerDocument,
  type FlippFlyerDocumentOffer,
} from "@/lib/weekly-ad-ingestion/flipp-flyer-document";
import {
  fetchFlippFlyerSummaries,
  type FlippFlyerSummary,
} from "@/lib/weekly-ad-ingestion/flipp-weekly-ad-feed";
import type { WeeklyAdRawOffer } from "@/lib/weekly-ad-ingestion/weekly-ad-ingestion-types";

export const PUBLIX_FLIPP_FLYER_MIN_ITEMS = 100;
export const PUBLIX_FLIPP_FLYER_SALE_LABEL = "Flipp flyer";

const CHARLOTTE_FLYER_NAME = /\bcharlotte\b/i;

export function publixFlyersEligibleForDocument(
  flyers: readonly FlippFlyerSummary[],
): FlippFlyerSummary[] {
  return flyers.filter((flyer) => {
    if (flyer.merchant?.trim().toLowerCase() !== "publix") {
      return false;
    }
    if (typeof flyer.id !== "number") {
      return false;
    }
    return !CHARLOTTE_FLYER_NAME.test(flyer.name ?? "");
  });
}

/** The eligible flyer with the most items, when that count is at least 100. */
export function choosePublixFlippFlyerId(
  candidates: readonly { flyerId: number; itemCount: number }[],
  minItems: number = PUBLIX_FLIPP_FLYER_MIN_ITEMS,
): number | null {
  const eligible = candidates.filter((candidate) => candidate.itemCount >= minItems);
  if (eligible.length === 0) {
    return null;
  }
  eligible.sort(
    (left, right) =>
      right.itemCount - left.itemCount || left.flyerId - right.flyerId,
  );
  return eligible[0]?.flyerId ?? null;
}

export function publixFlippFlyerSaleLabel(existing: string | undefined): string {
  const rest = existing?.trim();
  return rest ? `${PUBLIX_FLIPP_FLYER_SALE_LABEL} · ${rest}` : PUBLIX_FLIPP_FLYER_SALE_LABEL;
}

export function publixFlippDocumentToRawOffers(
  offers: readonly FlippFlyerDocumentOffer[],
): WeeklyAdRawOffer[] {
  return offers.map((offer) => ({
    productName: offer.productName,
    price: offer.price,
    saleLabel: publixFlippFlyerSaleLabel(offer.saleLabel),
    validFrom: offer.validFrom,
    validThrough: offer.validThrough,
  }));
}

export async function loadPublixFlippFlyerOffers(input: {
  zipCode: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  offers: WeeklyAdRawOffer[];
  flyerId: number | null;
  itemCount: number;
  message?: string;
}> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const flyers = await fetchFlippFlyerSummaries({
    zipCode: input.zipCode,
    fetchImpl,
  });
  const eligible = publixFlyersEligibleForDocument(flyers);
  const documents: { flyerId: number; itemCount: number; offers: WeeklyAdRawOffer[] }[] =
    [];

  for (const flyer of eligible) {
    const flyerId = flyer.id;
    if (typeof flyerId !== "number") {
      continue;
    }
    const loaded = await fetchPublixFlyerDocument({
      flyerId,
      postalCode: input.zipCode,
      fetchImpl,
    });
    documents.push({
      flyerId,
      itemCount: loaded.itemCount,
      offers: loaded.offers,
    });
  }

  const flyerId = choosePublixFlippFlyerId(documents);
  if (flyerId === null) {
    return {
      offers: [],
      flyerId: null,
      itemCount: 0,
      message:
        "Publix Flipp flyer fallback found no flyer with 100 or more items on this ZIP's list.",
    };
  }
  const chosen = documents.find((document) => document.flyerId === flyerId);
  return {
    offers: chosen?.offers ?? [],
    flyerId,
    itemCount: chosen?.itemCount ?? 0,
  };
}

async function fetchPublixFlyerDocument(input: {
  flyerId: number;
  postalCode: string;
  fetchImpl: typeof fetch;
}): Promise<{ itemCount: number; offers: WeeklyAdRawOffer[] }> {
  const response = await input.fetchImpl(
    buildFlippFlyerDocumentUrl({
      flyerId: input.flyerId,
      postalCode: input.postalCode,
    }),
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Flipp flyer document ${input.flyerId} failed with HTTP ${response.status}`,
    );
  }
  const document = (await response.json()) as FlippFlyerDocument;
  const itemCount = document.items?.length ?? 0;
  return {
    itemCount,
    offers: publixFlippDocumentToRawOffers(parseFlippFlyerDocument(document)),
  };
}
