export const zipCodeHelp = {
  tooltip: "Continental US ZIP codes.",
  popoverTitle: "ZIP code coverage",
  popoverContent:
    "Yum4Less accepts continental US ZIP codes in beta. Ranked dinner estimates for production deploy focus on Kroger-family and Aldi when daily ingest and promotion gates pass. Other chains may appear on the map as context; ranked pricing for them is planned in upcoming releases. Tier C — map/context only — is normal where ranked data is not ready.",
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
    "This total combines recently checked online prices and saved weekly-ad prices from nearby stores on the trusted pricing rollout. Treat it as an estimate—verify price, package size, and current shelf tags before you buy.",
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
    "Freshness tells you how recently Yum4Less ingested or checked the underlying price information. Ranked reads use a 24-hour cache window refreshed by daily ingest — older rows are more directional. Electronic shelf labels and checkout systems can still change before you shop.",
} as const;

export const pricingTrustHeadsUpHelp = {
  tooltip: "Why these prices may differ from checkout.",
  popoverTitle: "Price trust signals",
  popoverContent:
    "This beta banner appears when Yum4Less is using saved weekly ads, recently checked online prices, backup store data, limited ZIP lookup, or other non-checkout sources. Not every nearby chain is live-priced yet. Treat meal totals as estimates and confirm price, package size, and deals before you shop.",
} as const;

export const recipeSourceHelp = {
  tooltip: "Internal library or sale-matched TheMealDB.",
  popoverTitle: "Recipe source",
  popoverContent:
    "Rank dinners from Yum4Less's internal library or TheMealDB imports that overlap local weekly-ad sale ingredients. TheMealDB meals include attribution and still require verify-in-store pricing.",
} as const;

export const nearbyStoresMapHelp = {
  tooltip: "Catalog pins — not live retailer GPS.",
  popoverTitle: "Nearby stores map",
  popoverContent:
    "Pins use beta catalog, rehearsal seed, or OpenStreetMap coordinates — not a live snapshot of every retailer address. Verify store locations before visiting. Chain-colored badges mark Kroger-family and Aldi stores that can feed ranked dinner totals when weekly-ad or online-cache rollout gates pass—totals stay estimated and directional. Other chains may appear for context; ranked pricing for them is planned in upcoming releases. Gray badges with a gold border are context only: nearby for planning, not ranked meal pricing. Walmart is always context only until trustworthy live matching exists.",
} as const;

export const mealPriceSourceHelp = {
  tooltip: "Where this meal total came from.",
  popoverTitle: "Price source",
  popoverContent:
    "Each ranked meal total combines saved store prices from nearby locations on the trusted rollout—usually recently checked online prices or weekly-ad pulls. Walmart is excluded until live matching is trustworthy. These are estimates, not checkout totals. Confirm price, package size, and deals in the store before you buy.",
} as const;
