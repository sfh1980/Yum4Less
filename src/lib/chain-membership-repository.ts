import {
  EMPTY_CHAIN_MEMBERSHIP,
  FIXTURE_CHAIN_MEMBERSHIP,
  membershipFromRegistryRows,
  type ChainMembershipSnapshot,
} from "@/lib/chain-membership";
import { listChainRegistry } from "@/lib/owner/store-coverage-repository";

export function isMissingChainRegistryRelation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /chain_registry/i.test(message);
}

function allowFixtureMembershipFallback(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Production authority for who we attempt for dinners / fail-loud ingest.
 * Missing table in production → empty roster (no estimates), not a TypeScript list.
 * Vitest without the table uses the fixture snapshot so unit tests stay deterministic.
 */
export async function loadChainMembership(): Promise<ChainMembershipSnapshot> {
  if (!process.env.DATABASE_URL) {
    return allowFixtureMembershipFallback()
      ? FIXTURE_CHAIN_MEMBERSHIP
      : EMPTY_CHAIN_MEMBERSHIP;
  }

  try {
    const rows = await listChainRegistry();
    return membershipFromRegistryRows(rows);
  } catch (error) {
    if (isMissingChainRegistryRelation(error)) {
      return allowFixtureMembershipFallback()
        ? FIXTURE_CHAIN_MEMBERSHIP
        : EMPTY_CHAIN_MEMBERSHIP;
    }

    throw error;
  }
}
