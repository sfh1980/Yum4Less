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
    borderColor: "#ffc87e",
  },
  bjs: {
    abbreviation: "BJ",
    backgroundColor: "#c8102e",
    textColor: "#ffffff",
    borderColor: "#ffc87e",
  },
  "food-lion": {
    abbreviation: "FL",
    backgroundColor: "#00843d",
    textColor: "#ffffff",
    borderColor: "#ffc87e",
  },
  lidl: {
    abbreviation: "L",
    backgroundColor: "#0050aa",
    textColor: "#fff000",
    borderColor: "#ffc87e",
  },
  "trader-joes": {
    abbreviation: "TJ",
    backgroundColor: "#c8102e",
    textColor: "#ffffff",
    borderColor: "#ffc87e",
  },
  "dollar-general": {
    abbreviation: "DG",
    backgroundColor: "#ffcc00",
    textColor: "#000000",
    borderColor: "#ffc87e",
  },
  unknown: {
    abbreviation: "?",
    backgroundColor: "#4a5568",
    textColor: "#ffffff",
    borderColor: "#ffc87e",
  },
};

export function getStoreMarkerStyle(input: {
  chain: StoreChain;
  recommendationEnabled: boolean;
}): StoreMarkerStyle {
  const base = CHAIN_MARKER_STYLES[input.chain] ?? CHAIN_MARKER_STYLES.unknown;

  if (input.recommendationEnabled) {
    return base;
  }

  return {
    ...base,
    backgroundColor: "#334155",
    borderColor: "#ffc87e",
    textColor: "#f8fafc",
  };
}

export function buildStoreMarkerIconHtml(style: StoreMarkerStyle) {
  return `<span class="store-map-marker-badge" style="background:${style.backgroundColor};color:${style.textColor};border-color:${style.borderColor}">${style.abbreviation}</span>`;
}
