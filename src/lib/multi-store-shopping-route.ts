export type RouteStop = {
  label: string;
  latitude: number;
  longitude: number;
  kind: "home" | "store";
};

export type ShoppingRoutePlan = {
  orderedStops: RouteStop[];
  totalDistanceMiles: number;
  estimatedDriveMinutes: number;
  source: "osrm" | "fallback-distance";
  message: string;
};

const OSRM_TRIP_URL = "https://router.project-osrm.org/trip/v1/driving";

export async function buildMultiStoreShoppingRoute(input: {
  home: { latitude: number; longitude: number; label?: string };
  stores: Array<{ storeName: string; latitude: number; longitude: number }>;
}): Promise<ShoppingRoutePlan> {
  const homeLabel = input.home.label ?? "Home";
  const uniqueStores = dedupeStores(input.stores);

  if (uniqueStores.length === 0) {
    return {
      orderedStops: [
        {
          label: homeLabel,
          latitude: input.home.latitude,
          longitude: input.home.longitude,
          kind: "home",
        },
      ],
      totalDistanceMiles: 0,
      estimatedDriveMinutes: 0,
      source: "fallback-distance",
      message: "No store stops were available for route planning.",
    };
  }

  const osrmPlan = await tryOsrmRoundTrip(input.home, uniqueStores, homeLabel);
  if (osrmPlan) {
    return osrmPlan;
  }

  return buildFallbackRoute(input.home, uniqueStores, homeLabel);
}

function dedupeStores(
  stores: Array<{ storeName: string; latitude: number; longitude: number }>,
) {
  const seen = new Set<string>();
  return stores.filter((store) => {
    const key = `${store.storeName}-${store.latitude}-${store.longitude}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function tryOsrmRoundTrip(
  home: { latitude: number; longitude: number },
  stores: Array<{ storeName: string; latitude: number; longitude: number }>,
  homeLabel: string,
): Promise<ShoppingRoutePlan | undefined> {
  const coordinates = [
    `${home.longitude},${home.latitude}`,
    ...stores.map((store) => `${store.longitude},${store.latitude}`),
  ].join(";");
  const url = `${OSRM_TRIP_URL}/${coordinates}?roundtrip=true&source=first&geometries=geojson`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as OsrmTripResponse;
    if (payload.code !== "Ok" || !payload.trips?.[0]?.waypoint_order) {
      return undefined;
    }

    const waypointOrder = payload.trips[0].waypoint_order;
    const allPoints = [
      { label: homeLabel, latitude: home.latitude, longitude: home.longitude, kind: "home" as const },
      ...stores.map((store) => ({
        label: store.storeName,
        latitude: store.latitude,
        longitude: store.longitude,
        kind: "store" as const,
      })),
    ];

    const orderedStops: RouteStop[] = waypointOrder.map((index) => allPoints[index]!);
    const totalDistanceMiles = roundDistance(
      (payload.trips[0].distance ?? 0) / 1609.34,
    );
    const estimatedDriveMinutes = Math.max(
      1,
      Math.round((payload.trips[0].duration ?? 0) / 60),
    );

    return {
      orderedStops,
      totalDistanceMiles,
      estimatedDriveMinutes,
      source: "osrm",
      message:
        "Estimated round-trip driving route from home through each store and back home. Times and order are directional and depend on live traffic.",
    };
  } catch {
    return undefined;
  }
}

function buildFallbackRoute(
  home: { latitude: number; longitude: number; label?: string },
  stores: Array<{ storeName: string; latitude: number; longitude: number }>,
  homeLabel: string,
): ShoppingRoutePlan {
  const remaining = [...stores];
  const orderedStoreStops: RouteStop[] = [];
  let current = { latitude: home.latitude, longitude: home.longitude };
  let totalDistanceMiles = 0;

  while (remaining.length > 0) {
    remaining.sort(
      (left, right) =>
        getDistanceMiles(current.latitude, current.longitude, left.latitude, left.longitude) -
        getDistanceMiles(current.latitude, current.longitude, right.latitude, right.longitude),
    );
    const next = remaining.shift()!;
    totalDistanceMiles += getDistanceMiles(
      current.latitude,
      current.longitude,
      next.latitude,
      next.longitude,
    );
    orderedStoreStops.push({
      label: next.storeName,
      latitude: next.latitude,
      longitude: next.longitude,
      kind: "store",
    });
    current = { latitude: next.latitude, longitude: next.longitude };
  }

  totalDistanceMiles += getDistanceMiles(
    current.latitude,
    current.longitude,
    home.latitude,
    home.longitude,
  );

  return {
    orderedStops: [
      { label: homeLabel, latitude: home.latitude, longitude: home.longitude, kind: "home" },
      ...orderedStoreStops,
      { label: homeLabel, latitude: home.latitude, longitude: home.longitude, kind: "home" },
    ],
    totalDistanceMiles: roundDistance(totalDistanceMiles),
    estimatedDriveMinutes: Math.max(1, Math.round(totalDistanceMiles * 2.5)),
    source: "fallback-distance",
    message:
      "Estimated route uses straight-line distance ordering because live road routing was unavailable. Treat stop order and time as directional only.",
  };
}

type OsrmTripResponse = {
  code: string;
  trips?: Array<{
    distance?: number;
    duration?: number;
    waypoint_order?: number[];
  }>;
};

function getDistanceMiles(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function roundDistance(value: number) {
  return Math.round(value * 10) / 10;
}
