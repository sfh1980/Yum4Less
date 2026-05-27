export const zipCodeHelp = {
  tooltip: "Local MVP area only.",
  popoverTitle: "ZIP code coverage",
  popoverContent:
    "Yum4Less MVP starts around ZIP 23111 in the Mechanicsville, VA area. Other ZIP codes may return limited store coverage or fall outside the supported local market.",
} as const;

export const radiusHelp = {
  tooltip: "How far to search for stores.",
  popoverTitle: "Search radius",
  popoverContent:
    "The radius sets the search circle around your ZIP code or browser location. A wider radius includes more stores on the map, but pins farther away may be less convenient for a single shopping trip.",
} as const;

export const mealTotalHelp = {
  tooltip: "Estimated cost, not a checkout total.",
  popoverTitle: "Estimated meal total",
  popoverContent:
    "This total combines ingredient prices from nearby stores that are on the trusted pricing rollout. Treat it as an estimate—verify price, package size, and current deals in the store before you buy.",
} as const;

export const confidenceLabelHelp = {
  tooltip: "How simple this shopping plan is.",
  popoverTitle: "Confidence label",
  popoverContent:
    "Confidence labels explain how straightforward the shopping plan is. Single-store estimates are usually easier to follow; multi-store plans may save money but depend on visiting more than one stop.",
} as const;

export const freshnessLabelHelp = {
  tooltip: "How recent the price data is.",
  popoverTitle: "Freshness label",
  popoverContent:
    "Freshness tells you how recent the underlying price information is. Newer pricing is more trustworthy; older pricing is more directional and should be double-checked in store.",
} as const;

export const pricingTrustHeadsUpHelp = {
  tooltip: "Why these prices may differ from checkout.",
  popoverTitle: "Price trust signals",
  popoverContent:
    "This banner appears when Yum4Less is using saved weekly ads, backup store data, limited ZIP lookup, or other non-live sources. Treat meal totals as estimates and confirm price, package size, and deals before you shop.",
} as const;

export const recipeSourceHelp = {
  tooltip: "Only the internal library ranks meals today.",
  popoverTitle: "Recipe source",
  popoverContent:
    "Ranked dinners use Yum4Less's curated internal recipe library. Other sources listed in the menu are research-only placeholders until licensing and matching quality are ready.",
} as const;

export const nearbyStoresMapHelp = {
  tooltip: "Not every map pin drives meal pricing.",
  popoverTitle: "Nearby stores map",
  popoverContent:
    "Pins show stores in your radius. Green \"Weekly ad prices\" locations use saved weekly-ad data for ranked dinner totals when rollout allows; gray \"Context only\" stores are nearby but not used for meal pricing yet. Walmart is always context only until live weekly-ad ingest works—no current, actionable Walmart deals. Totals are estimates—not live checkout.",
} as const;

export const mealPriceSourceHelp = {
  tooltip: "Where this meal total came from.",
  popoverTitle: "Price source",
  popoverContent:
    "Each ranked meal total combines saved store prices from nearby locations on the trusted rollout—usually weekly-ad pulls or recent saved chain prices. Walmart is excluded until live weekly-ad pricing is available. These are estimates, not live checkout totals. Confirm price, package size, and deals in the store before you buy.",
} as const;
