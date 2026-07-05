import type { StoreChain } from "@/lib/provider-rollout";

export type StoreMarkerStyle = {
  abbreviation: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

const CHAIN_MARKER_STYLES: Record<StoreChain, StoreMarkerStyle> = {
  kroger: {
    abbreviation: "K",
    backgroundColor: "#004c97",
    textColor: "#ffffff",
    borderColor: "#9fd4ff",
  },
  publix: {
    abbreviation: "P",
    backgroundColor: "#006633",
    textColor: "#ffffff",
    borderColor: "#9fd4ff",
  },
  walmart: {
    abbreviation: "W",
    backgroundColor: "#0071ce",
    textColor: "#ffc220",
    borderColor: "#9fd4ff",
  },
  aldi: {
    abbreviation: "A",
    backgroundColor: "#00529b",
    textColor: "#ffffff",
    borderColor: "#993556",
  },
  bjs: {
    abbreviation: "BJ",
    backgroundColor: "#c8102e",
    textColor: "#ffffff",
    borderColor: "#993556",
  },
  "food-lion": {
    abbreviation: "FL",
    backgroundColor: "#00843d",
    textColor: "#ffffff",
    borderColor: "#993556",
  },
  lidl: {
    abbreviation: "L",
    backgroundColor: "#0050aa",
    textColor: "#fff000",
    borderColor: "#993556",
  },
  "trader-joes": {
    abbreviation: "TJ",
    backgroundColor: "#c8102e",
    textColor: "#ffffff",
    borderColor: "#993556",
  },
  "dollar-general": {
    abbreviation: "DG",
    backgroundColor: "#ffcc00",
    textColor: "#000000",
    borderColor: "#993556",
  },
  unknown: {
    abbreviation: "?",
    backgroundColor: "#4a5568",
    textColor: "#ffffff",
    borderColor: "#993556",
  },
};

export function deriveStoreMarkerAbbreviation(
  storeName: string,
  chain: StoreChain,
): string {
  if (chain !== "unknown") {
    return (CHAIN_MARKER_STYLES[chain] ?? CHAIN_MARKER_STYLES.unknown).abbreviation;
  }

  const normalized = storeName.trim();
  if (!normalized) {
    return "?";
  }

  if (/^7[\s-]?eleven/i.test(normalized)) {
    return "7E";
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

export function getStoreMarkerStyle(input: {
  chain: StoreChain;
  storeName: string;
  recommendationEnabled: boolean;
}): StoreMarkerStyle {
  const base = CHAIN_MARKER_STYLES[input.chain] ?? CHAIN_MARKER_STYLES.unknown;
  const abbreviation = deriveStoreMarkerAbbreviation(input.storeName, input.chain);
  const styledBase = { ...base, abbreviation };

  if (input.recommendationEnabled) {
    return styledBase;
  }

  return {
    ...styledBase,
    backgroundColor: "#334155",
    borderColor: "#993556",
    textColor: "#f8fafc",
  };
}

export function buildStoreMarkerIconHtml(style: StoreMarkerStyle) {
  return `<span class="store-map-marker-badge" style="background:${style.backgroundColor};color:${style.textColor};border-color:${style.borderColor}">${style.abbreviation}</span>`;
}
