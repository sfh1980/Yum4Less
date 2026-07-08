import type { OsmDiscoveredFoodRetailStore } from "@/lib/osm-food-retail-discovery";

/** Deterministic OSM-style map-context stores near ZIP 23111 for local CI / yum4less_test.
 * Catalog identity is fixture-osm-{type}-{osmId} + source_name yum4less-map-fixture
 * (never live osm-* / openstreetmap-overpass). Numeric osmIds stay in the 90000x
 * synthetic band so they cannot collide with real Overpass ids.
 */
export const fixtureOsmFoodRetailStores23111: OsmDiscoveredFoodRetailStore[] = [
  {
    osmType: "node",
    osmId: 900001,
    name: "Costco Wholesale",
    kind: "big-box",
    city: "Glen Allen",
    state: "VA",
    latitude: 37.6682,
    longitude: -77.4561,
    shopTag: "wholesale",
  },
  {
    osmType: "node",
    osmId: 900002,
    name: "Sam's Club",
    kind: "big-box",
    city: "Richmond",
    state: "VA",
    latitude: 37.5584,
    longitude: -77.4123,
    shopTag: "wholesale",
  },
  {
    osmType: "node",
    osmId: 900003,
    name: "International Grocery Market",
    kind: "specialty",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6211,
    longitude: -77.3412,
    shopTag: "supermarket",
  },
  {
    osmType: "node",
    osmId: 900004,
    name: "7-Eleven",
    kind: "specialty",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6028,
    longitude: -77.3554,
    shopTag: "convenience",
  },
  {
    osmType: "node",
    osmId: 900006,
    name: "Kroger",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.6095,
    longitude: -77.3736,
    shopTag: "supermarket",
  },
  {
    osmType: "node",
    // Synthetic fixture id (not live OSM). Coords match verified Mechanicsville
    // Aldi storefront / real OSM node 6531578976 / aldi-mechanicsville bootstrap.
    osmId: 900007,
    name: "Aldi",
    kind: "grocery",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.611004,
    longitude: -77.336853,
    shopTag: "supermarket",
  },
  {
    osmType: "node",
    osmId: 900005,
    name: "BJ's Wholesale Club",
    kind: "big-box",
    city: "Mechanicsville",
    state: "VA",
    latitude: 37.601124,
    longitude: -77.34944,
    shopTag: "wholesale",
  },
];
