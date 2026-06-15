import type { SnapRetailerLocationRow } from "@/lib/snap-retailer-locations";

/** Deterministic SNAP-style rows near ZIP 23111 for CI and fixture ingest. */
export const fixtureSnapRetailers23111: SnapRetailerLocationRow[] = [
  {
    id: "snap-va-23111-food-lion",
    retailerName: "FOOD LION",
    retailerType: "SM",
    addressLine1: "7350 Mechanicsville Tpke",
    city: "Mechanicsville",
    state: "VA",
    zipCode: "23111",
    latitude: 37.6098,
    longitude: -77.3562,
    snapshotDate: "2025-12-31",
  },
  {
    id: "snap-va-23111-walmart",
    retailerName: "WM SUPERCENTER #2435",
    retailerType: "SS",
    addressLine1: "6720 Richmond Hwy",
    city: "Mechanicsville",
    state: "VA",
    zipCode: "23111",
    latitude: 37.6234,
    longitude: -77.3381,
    snapshotDate: "2025-12-31",
  },
  {
    id: "snap-va-23111-independent",
    retailerName: "MECHANICSVILLE FAMILY MARKET",
    retailerType: "LG",
    addressLine1: "9129 Atlee Rd",
    city: "Mechanicsville",
    state: "VA",
    zipCode: "23111",
    latitude: 37.6412,
    longitude: -77.3714,
    snapshotDate: "2025-12-31",
  },
];
