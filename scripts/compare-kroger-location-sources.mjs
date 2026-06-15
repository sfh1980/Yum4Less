import { loadEnvLocal } from "./lib/load-env-local.mjs";
import {
  createKrogerApiClient,
  readKrogerApiCredentialsFromEnv,
} from "../src/lib/providers/kroger/kroger-api-client.ts";

loadEnvLocal();

const ZIP = process.env.YUM4LESS_INGEST_ZIP ?? "23111";
const RADIUS_MILES = 10;

function distMi(a, b) {
  const R = 3958.8;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLon = toR(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatAddress(parts) {
  return parts.filter(Boolean).join(", ");
}

async function geocodioGeocode(query) {
  const key = process.env.GEOCODIO_API_KEY?.trim();
  if (!key) {
    return { error: "GEOCODIO_API_KEY not set" };
  }

  const url = `https://api.geocod.io/v1.7/geocode?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    return { error: `Geocodio HTTP ${response.status}` };
  }

  const payload = await response.json();
  const result = payload.results?.[0];
  if (!result?.location) {
    return { error: "No Geocodio result", query };
  }

  const ac = result.address_components ?? {};
  return {
    query,
    formatted: result.formatted_address,
    street: ac.number && ac.formatted_street ? `${ac.number} ${ac.formatted_street}` : ac.formatted_street,
    city: ac.city,
    state: ac.state,
    zip: ac.zip,
    lat: result.location.lat,
    lon: result.location.lng,
    accuracy: result.accuracy,
    accuracyType: result.accuracy_type,
  };
}

async function fetchOsmKrogers(lat, lon, radiusMiles) {
  const tags =
    "supermarket|greengrocer|bakery|butcher|seafood|deli|convenience|wholesale";
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const query = `
[out:json][timeout:25];
(
  nwr(around:${radiusMeters},${lat},${lon})["brand"~"Kroger",i]["shop"];
);
out center tags;
`.trim();

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "Yum4Less/0.1 location-compare",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    return { error: `Overpass HTTP ${response.status}` };
  }

  const payload = await response.json();
  return (payload.elements ?? []).map((element) => {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const addr = formatAddress([
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:city"],
      tags["addr:state"],
      tags["addr:postcode"],
    ]);
    return {
      osmId: `${element.type}/${element.id}`,
      name: tags.brand || tags.name,
      address: addr || "(no addr tags)",
      lat,
      lon,
      shop: tags.shop,
    };
  });
}

async function fetchPostgresKroger() {
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    return { error: "DATABASE_URL not set" };
  }

  try {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: dbUrl });
    const result = await pool.query(
      `select id, name, city, state, latitude, longitude, source_name, source_store_id
       from stores where id like 'kroger%' or lower(name) like '%kroger%'`,
    );
    await pool.end();
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      state: row.state,
      lat: Number(row.latitude),
      lon: Number(row.longitude),
      sourceName: row.source_name,
      sourceStoreId: row.source_store_id,
    }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function printComparison(label, api, geocodio) {
  console.log(`\n--- ${label} ---`);
  if (api.error) {
    console.log(`Kroger API: ERROR ${api.error}`);
    return;
  }

  console.log("Kroger API:");
  console.log(`  locationId: ${api.locationId}`);
  console.log(`  name:       ${api.name}`);
  console.log(`  address:    ${api.address}`);
  console.log(`  lat/lon:    ${api.lat}, ${api.lon}`);

  if (geocodio.error) {
    console.log(`Geocodio:   ERROR ${geocodio.error}`);
    return;
  }

  console.log("Geocodio (forward geocode of API address):");
  console.log(`  query:      ${geocodio.query}`);
  console.log(`  formatted:  ${geocodio.formatted}`);
  console.log(`  lat/lon:    ${geocodio.lat}, ${geocodio.lon}`);
  console.log(`  accuracy:   ${geocodio.accuracyType} (${geocodio.accuracy})`);

  const streetMatch =
    api.streetLine &&
    geocodio.street &&
    api.streetLine.toLowerCase().includes(geocodio.street.split(" ")[0]?.toLowerCase() ?? "");
  const coordDeltaMi =
    api.lat != null && geocodio.lat != null
      ? distMi({ lat: api.lat, lon: api.lon }, { lat: geocodio.lat, lon: geocodio.lon })
      : null;

  console.log("Agreement:");
  console.log(`  street roughly matches: ${streetMatch ? "YES" : "NO / check manually"}`);
  console.log(
    `  API vs Geocodio distance: ${coordDeltaMi != null ? `${coordDeltaMi.toFixed(3)} mi` : "n/a"}`,
  );
  console.log(
    `  same pin (<= 0.05 mi): ${coordDeltaMi != null && coordDeltaMi <= 0.05 ? "YES" : "NO"}`,
  );
}

async function main() {
  console.log(`\n=== Kroger location source comparison (ZIP ${ZIP}) ===\n`);

  const zipGeocode = await geocodioGeocode(ZIP);
  if (!zipGeocode.error) {
    console.log("Geocodio ZIP centroid (search anchor):");
    console.log(`  ${zipGeocode.formatted}`);
    console.log(`  lat/lon: ${zipGeocode.lat}, ${zipGeocode.lon}`);
  }

  const credentials = readKrogerApiCredentialsFromEnv();
  const api = createKrogerApiClient(credentials);

  if (!api.isConfigured) {
    console.error("Kroger API not configured.");
    process.exit(1);
  }

  const locations = await api.searchLocations({
    zipCodeNear: ZIP,
    radiusInMiles: RADIUS_MILES,
    limit: 5,
    chain: "Kroger",
  });

  console.log(`\nKroger API returned ${locations.length} location(s) within ${RADIUS_MILES} mi of ZIP ${ZIP}`);

  for (const [index, location] of locations.entries()) {
    const addr = location.address ?? {};
    const streetLine = formatAddress([
      addr.addressLine1,
      addr.city,
      addr.state,
      addr.zipCode,
    ]);
    const apiRecord = {
      locationId: location.locationId,
      name: location.name,
      address: streetLine,
      streetLine: addr.addressLine1,
      lat: location.geolocation?.latitude,
      lon: location.geolocation?.longitude,
    };

    const geocodeQuery = formatAddress([
      addr.addressLine1,
      addr.city,
      `${addr.state} ${addr.zipCode}`,
    ]);
    const geocodio = await geocodioGeocode(geocodeQuery);
    printComparison(`Kroger API store #${index + 1}`, apiRecord, geocodio);
  }

  const anchor = zipGeocode.error
    ? { lat: 37.628179, lon: -77.281955 }
    : { lat: zipGeocode.lat, lon: zipGeocode.lon };

  console.log("\n=== OpenStreetMap Kroger (Overpass) ===");
  const osmKrogers = await fetchOsmKrogers(anchor.lat, anchor.lon, 5);
  if (osmKrogers.error) {
    console.log(`ERROR: ${osmKrogers.error}`);
  } else if (osmKrogers.length === 0) {
    console.log("No Kroger brand tags found in 5 mi radius.");
  } else {
    for (const row of osmKrogers) {
      console.log(`\n  ${row.osmId}`);
      console.log(`  address: ${row.address}`);
      console.log(`  lat/lon: ${row.lat}, ${row.lon}`);
    }
  }

  console.log("\n=== Postgres / Yum4Less map pins (stores table) ===");
  const postgres = await fetchPostgresKroger();
  if (postgres.error) {
    console.log(`  (skipped: ${postgres.error})`);
  } else {
    for (const row of postgres) {
      console.log(`\n  id: ${row.id}`);
      console.log(`  source: ${row.sourceName}`);
      console.log(`  lat/lon: ${row.lat}, ${row.lon}`);
    }
  }

  const seed = { id: "kroger-mechanicsville", lat: 37.6153, lon: -77.3491 };
  console.log("\n=== Bootstrap seed (002_seed.sql) ===");
  console.log(`  id: ${seed.id}`);
  console.log(`  lat/lon: ${seed.lat}, ${seed.lon}`);

  if (locations[0]?.geolocation) {
    const first = locations[0];
    const apiPin = {
      lat: first.geolocation.latitude,
      lon: first.geolocation.longitude,
    };
    const geocodeQuery = formatAddress([
      first.address?.addressLine1,
      first.address?.city,
      `${first.address?.state} ${first.address?.zipCode}`,
    ]);
    const geocodioForFirst = await geocodioGeocode(geocodeQuery);

    console.log("\n=== Distance summary (miles) ===");
    if (!geocodioForFirst.error) {
      console.log(
        `  Kroger API #1 vs Geocodio(API address): ${distMi(apiPin, { lat: geocodioForFirst.lat, lon: geocodioForFirst.lon }).toFixed(3)}`,
      );
    }
    console.log(
      `  Kroger API #1 vs OSM way/321835718 (6335 Tpke): ${distMi(apiPin, { lat: 37.6147573, lon: -77.3193991 }).toFixed(3)}`,
    );
    console.log(`  Kroger API #1 vs bootstrap seed: ${distMi(apiPin, seed).toFixed(3)}`);
    console.log(
      `  Bootstrap seed vs OSM old building: ${distMi(seed, { lat: 37.6147573, lon: -77.3193991 }).toFixed(3)}`,
    );
  }

  console.log("\n=== Leaflet note ===");
  console.log(
    "Leaflet does NOT provide store locations. It renders OpenStreetMap raster tiles as the basemap.",
  );
  console.log(
    "Building labels/outlines you see under the pin come from OSM cartography; Yum4Less pins are separate divIcon overlays from Postgres/OSM-merge/seed.",
  );
  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
