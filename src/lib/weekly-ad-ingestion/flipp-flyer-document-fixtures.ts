import type { FlippFlyerDocument } from "@/lib/weekly-ad-ingestion/flipp-flyer-document";

/**
 * Minimal items copied from captures/flipp-doc-overlap/2026-11-04T02-16-27-499Z.
 * The captures stay untracked. These objects are the test inputs.
 */

export const KROGER_8208783: FlippFlyerDocument = {
  items: [
    {
      id: 1050394307,
      flyer_id: 8208783,
      name: "Pineapple",
      brand: null,
      price: "3.0",
      valid_from: "2026-10-29T00:00:00-04:00",
      valid_to: "2026-10-31T23:59:59-04:00",
      display_type: 1,
    },
    {
      id: 1050392261,
      flyer_id: 8208783,
      name: "Boneless Chuck Roast",
      brand: null,
      price: "7.99",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1050392794,
      flyer_id: 8208783,
      name: "Big K",
      brand: "Big K",
      price: "3.0",
      valid_from: "2026-10-29T00:00:00-04:00",
      valid_to: "2026-10-31T23:59:59-04:00",
      display_type: 1,
    },
    {
      id: 1050392541,
      flyer_id: 8208783,
      name: "4X points on gift cards* with digital coupon",
      brand: null,
      price: "",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 5,
    },
  ],
};

export const FOOD_LION_8195596: FlippFlyerDocument = {
  items: [
    {
      id: 1049073614,
      flyer_id: 8195596,
      name: "Nabisco Premium Crackers",
      brand: "Nabisco",
      price: "3.49",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1049076607,
      flyer_id: 8195596,
      name: "Scott & Jon's Shrimp or Fish Entrée",
      brand: "Scott & Jon's",
      price: "3.99",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1049058479,
      flyer_id: 8195596,
      name: "Entenmann's Little Bites Muffins",
      brand: "Entenmann's",
      price: "",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
  ],
};

export const ALDI_8206872: FlippFlyerDocument = {
  items: [
    {
      id: 1050048122,
      flyer_id: 8206872,
      name: "Fresh Family Pack Chicken Tenderloins",
      brand: null,
      price: "2.09",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1050047897,
      flyer_id: 8206872,
      name: "Emporium Selection Aged Reserved White Cheddar",
      brand: "Emporium Selection",
      price: "2.69",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
  ],
};

export const LIDL_8193559: FlippFlyerDocument = {
  items: [
    {
      id: 1048589806,
      flyer_id: 8193559,
      name: "Honeycrisp apple",
      brand: null,
      price: "1.79",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1048589866,
      flyer_id: 8193559,
      name: "Lidl Preferred Selection cured ham, family size",
      brand: "Lidl Preferred Selection",
      price: "6.99",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
  ],
};

export const PUBLIX_8205499: FlippFlyerDocument = {
  items: [
    {
      id: 1049813977,
      flyer_id: 8205499,
      name: "Cookies and Cream Mini Cream Cheese Pie",
      brand: null,
      price: "5.99",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1049817934,
      flyer_id: 8205499,
      name: "Nestlé Toll House Cookie Dough BOGO*",
      brand: "Nestle",
      price: "",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
  ],
};

export const HARRIS_TEETER_8206061: FlippFlyerDocument = {
  items: [
    {
      id: 1049947030,
      flyer_id: 8206061,
      name: "Tillamook Shredded Cheese",
      brand: "Tillamook",
      price: "3.99",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1049950548,
      flyer_id: 8206061,
      name: "Cap'n Crunch Cereal",
      brand: "Cap'n Crunch",
      price: "",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
  ],
};

/** Kroger common flyer 8191621. Names are general merchandise, not the grocery ad. */
export const KROGER_COMMON_8191621: FlippFlyerDocument = {
  items: [
    {
      id: 1048226940,
      flyer_id: 8191621,
      name: "Dash of That® 11-Piece Cookie Cutter Set",
      brand: "Dash of That®",
      price: "10.39",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
    {
      id: 1048226957,
      flyer_id: 8191621,
      name: "Halloween Apparel",
      brand: null,
      price: "",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 1,
    },
  ],
};

/** Walmart 8210320 sample. The full document is mostly general merchandise. */
export const WALMART_8210320: FlippFlyerDocument = {
  items: [
    {
      id: 1050659542,
      flyer_id: 8210320,
      name: 'Alienware Aurora 16" WQXGA 120Hz Gaming Laptop, Intel Core 7-240H, NVIDIA RTX 5050, 16GB RAM, 512GB SSD, Windows 11, Blue, AC16250',
      brand: "Alienware",
      price: "1099.0",
      valid_from: "2026-10-28T00:00:00-04:00",
      valid_to: "2026-11-03T23:59:59-05:00",
      display_type: 5,
    },
  ],
};
