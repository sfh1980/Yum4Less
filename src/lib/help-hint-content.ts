export const zipCodeHelp = {
  tooltip: "Continental US ZIP codes.",
  popoverTitle: "ZIP code coverage",
  popoverContent:
    "Yum4Less accepts continental US ZIP codes. Some stores show dinner estimates; others appear on the map for planning only. That is normal in many areas.",
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
    "This total combines recently checked online prices and saved sale prices from nearby stores you selected. Treat it as an estimate—verify price, package size, and current shelf tags before you buy.",
} as const;

export const confidenceLabelHelp = {
  tooltip: "How simple this shopping plan is.",
  popoverTitle: "Confidence label",
  popoverContent:
    "Confidence labels explain how straightforward the shopping plan is. Single-store estimates are usually easier to follow; multi-store plans compare prices across your selected stores but depend on visiting more than one stop.",
} as const;

export const freshnessLabelHelp = {
  tooltip: "How recent the price data is.",
  popoverTitle: "Freshness label",
  popoverContent:
    "Freshness tells you how recently prices were checked. Prices can change before you shop; older rows are less reliable.",
} as const;

export const pricingTrustHeadsUpHelp = {
  tooltip: "Why these prices may differ from checkout.",
  popoverTitle: "Price trust signals",
  popoverContent:
    "This banner appears when Yum4Less is using saved sale prices, recently checked online prices, backup store data, limited ZIP lookup, or other non-checkout sources. Treat meal totals as estimates and confirm price, package size, and deals before you shop.",
} as const;

export const recipeSourceHelp = {
  tooltip: "Merged internal library + TheMealDB ranking.",
  popoverTitle: "Recipe source",
  popoverContent:
    "Suggest dinners from Yum4Less's internal recipe library merged with TheMealDB imports that overlap sale ingredients at your stores. TheMealDB meals include attribution and still require verify-in-store pricing.",
} as const;

export const nearbyStoresMapHelp = {
  tooltip: "Catalog pins — not live retailer GPS.",
  popoverTitle: "Nearby stores map",
  popoverContent:
    "Pins come from saved store data or map sources — confirm locations before visiting. Colored badges mark stores with dinner estimates; gray badges are nearby for planning only.",
} as const;

export const mealPriceSourceHelp = {
  tooltip: "Where this meal total came from.",
  popoverTitle: "Price source",
  popoverContent:
    "Each dinner total combines saved store prices from nearby locations you selected. These are estimates, not checkout totals. Confirm price, package size, and deals in the store before you buy.",
} as const;
