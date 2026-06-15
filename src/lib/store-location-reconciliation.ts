import type { ProviderDiscoveredStore } from "@/lib/providers/provider-types";

export type LocationWitnessSource =
  | "kroger-official-api"
  | "geocodio"
  | "usda-snap";

export type LocationWitness = {
  source: LocationWitnessSource;
  latitude: number;
  longitude: number;
};

export type RankedStoreCoordinateState = {
  latitude: number;
  longitude: number;
  sourceName?: string | null;
};

export type ReconcileRankedStoreCoordinatesResult = {
  action: "update" | "keep";
  latitude: number;
  longitude: number;
  reason: string;
};

export const DEFAULT_WITNESS_AGREEMENT_METERS = 250;
export const DEFAULT_COORD_CHANGE_THRESHOLD_METERS = 50;

const BOOTSTRAP_COORD_SOURCE_MARKERS = [
  "yum4less-internal-catalog",
  "weekly-ad-scrape",
] as const;

export function resolveWitnessAgreementMeters(
  value = process.env.YUM4LESS_LOCATION_WITNESS_AGREEMENT_METERS,
): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_WITNESS_AGREEMENT_METERS;
}

export function resolveCoordChangeThresholdMeters(
  value = process.env.YUM4LESS_LOCATION_CHANGE_THRESHOLD_METERS,
): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return DEFAULT_COORD_CHANGE_THRESHOLD_METERS;
}

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function witnessesAgreeWithin(
  witnesses: LocationWitness[],
  maxDistanceMeters: number,
): boolean {
  if (witnesses.length < 2) {
    return false;
  }

  for (let leftIndex = 0; leftIndex < witnesses.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < witnesses.length; rightIndex += 1) {
      const left = witnesses[leftIndex]!;
      const right = witnesses[rightIndex]!;
      if (
        getDistanceMeters(
          left.latitude,
          left.longitude,
          right.latitude,
          right.longitude,
        ) > maxDistanceMeters
      ) {
        return false;
      }
    }
  }

  return true;
}

export function averageWitnessCoordinates(witnesses: LocationWitness[]): {
  latitude: number;
  longitude: number;
} {
  const total = witnesses.reduce(
    (accumulator, witness) => ({
      latitude: accumulator.latitude + witness.latitude,
      longitude: accumulator.longitude + witness.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / witnesses.length,
    longitude: total.longitude / witnesses.length,
  };
}

export function isBootstrapCoordinateSource(sourceName?: string | null): boolean {
  if (!sourceName) {
    return true;
  }

  return BOOTSTRAP_COORD_SOURCE_MARKERS.some((marker) => sourceName.includes(marker));
}

export function reconcileRankedStoreCoordinates(input: {
  current?: RankedStoreCoordinateState | null;
  witnesses: LocationWitness[];
  witnessAgreementMeters?: number;
  changeThresholdMeters?: number;
}): ReconcileRankedStoreCoordinatesResult {
  const witnessAgreementMeters =
    input.witnessAgreementMeters ?? resolveWitnessAgreementMeters();
  const changeThresholdMeters =
    input.changeThresholdMeters ?? resolveCoordChangeThresholdMeters();
  const current = input.current ?? null;
  const witnesses = input.witnesses.filter(
    (witness) =>
      Number.isFinite(witness.latitude) && Number.isFinite(witness.longitude),
  );

  if (witnesses.length === 0) {
    return {
      action: "keep",
      latitude: current?.latitude ?? 0,
      longitude: current?.longitude ?? 0,
      reason: "No location witnesses available.",
    };
  }

  const primaryWitness =
    witnesses.find((witness) => witness.source === "kroger-official-api") ??
    witnesses[0]!;

  if (witnesses.length === 1) {
    if (!current || isBootstrapCoordinateSource(current.sourceName)) {
      return {
        action: "update",
        latitude: primaryWitness.latitude,
        longitude: primaryWitness.longitude,
        reason: `Single ${primaryWitness.source} witness accepted for bootstrap promotion.`,
      };
    }

    return {
      action: "keep",
      latitude: current.latitude,
      longitude: current.longitude,
      reason:
        "Single witness is not enough to move an API-verified ranked pin — keep current coordinates.",
    };
  }

  if (!witnessesAgreeWithin(witnesses, witnessAgreementMeters)) {
    return {
      action: "keep",
      latitude: current?.latitude ?? primaryWitness.latitude,
      longitude: current?.longitude ?? primaryWitness.longitude,
      reason: `Location witnesses disagreed by more than ${witnessAgreementMeters} m — keep current coordinates.`,
    };
  }

  const proposed = averageWitnessCoordinates(witnesses);

  if (!current) {
    return {
      action: "update",
      latitude: proposed.latitude,
      longitude: proposed.longitude,
      reason: "Multiple agreeing witnesses established ranked store coordinates.",
    };
  }

  const deltaMeters = getDistanceMeters(
    current.latitude,
    current.longitude,
    proposed.latitude,
    proposed.longitude,
  );

  if (deltaMeters < changeThresholdMeters) {
    return {
      action: "keep",
      latitude: current.latitude,
      longitude: current.longitude,
      reason: `Witnesses agreed, but change (${Math.round(deltaMeters)} m) is below ${changeThresholdMeters} m threshold.`,
    };
  }

  return {
    action: "update",
    latitude: proposed.latitude,
    longitude: proposed.longitude,
    reason: `Multiple agreeing witnesses moved ranked pin by ${Math.round(deltaMeters)} m.`,
  };
}

export function buildProviderLocationWitness(
  store: ProviderDiscoveredStore,
): LocationWitness {
  return {
    source: "kroger-official-api",
    latitude: store.latitude,
    longitude: store.longitude,
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
