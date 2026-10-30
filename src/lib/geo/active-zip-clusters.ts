/**
 * Connected components of active ZIPs. An edge exists when either ZIP's
 * saved neighbor list names the other. A ZIP with no saved neighbors is its
 * own cluster unless some other active ZIP lists it.
 *
 * This is the same union the held round-robin branch uses for morning adds.
 * This file does not turn that add behavior on.
 */

const ZIP5 = /^\d{5}$/;

export function clusterActiveZipCodes(input: {
  activeZipCodes: readonly string[];
  touchingByActiveZip: ReadonlyMap<string, readonly string[]>;
}): string[][] {
  const active = [...new Set(input.activeZipCodes.map((zipCode) => zipCode.trim()))]
    .filter((zipCode) => ZIP5.test(zipCode))
    .sort((left, right) => left.localeCompare(right));
  const activeSet = new Set(active);
  const parent = new Map<string, string>(active.map((zipCode) => [zipCode, zipCode]));

  const find = (zipCode: string): string => {
    const current = parent.get(zipCode) ?? zipCode;
    if (current === zipCode) {
      return zipCode;
    }
    const root = find(current);
    parent.set(zipCode, root);
    return root;
  };

  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) {
      return;
    }
    if (leftRoot < rightRoot) {
      parent.set(rightRoot, leftRoot);
      return;
    }
    parent.set(leftRoot, rightRoot);
  };

  for (const zipCode of active) {
    for (const neighbor of input.touchingByActiveZip.get(zipCode) ?? []) {
      const trimmed = neighbor.trim();
      if (activeSet.has(trimmed)) {
        union(zipCode, trimmed);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const zipCode of active) {
    const root = find(zipCode);
    const members = groups.get(root) ?? [];
    members.push(zipCode);
    groups.set(root, members);
  }

  return [...groups.values()]
    .map((members) => members.sort((left, right) => left.localeCompare(right)))
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
}

/** ZIPs that share a cluster with the ZIP whose flyer was fetched. */
export function flyerZipClusterMemberSet(input: {
  flyerZipCode: string;
  activeZipCodes: readonly string[];
  touchingByActiveZip: ReadonlyMap<string, readonly string[]>;
}): Set<string> {
  const flyerZipCode = input.flyerZipCode.trim();
  const clusters = clusterActiveZipCodes(input);
  const members = clusters.find((group) => group.includes(flyerZipCode));
  if (members) {
    return new Set(members);
  }
  return ZIP5.test(flyerZipCode) ? new Set([flyerZipCode]) : new Set();
}

export function storeSharesFlyerZipCluster(input: {
  admittingZipCodes: readonly string[];
  flyerCluster: ReadonlySet<string>;
}): boolean {
  return input.admittingZipCodes.some((zipCode) => input.flyerCluster.has(zipCode.trim()));
}

/** Logged and stored on the weekly-ad job when the saved neighbor lists cannot be read. */
export function weeklyAdTouchingZipFailureMessage(error: string): string {
  return `Touching-ZIP lists could not be read (${error}). Weekly-ad wrote nothing.`;
}
