/**
 * Shared server default for market-search / rank / pantry identity lookups (Pass 3).
 * Injected lookups win; otherwise Postgres when expand ON, virtual singleton when OFF.
 */
import {
  isStoreIdentityExpandEnabled,
  type StoreIdentityEnv,
} from "@/lib/store-identity-flags";
import { createPostgresStoreIdentityLookupSafe } from "@/lib/store-identity-postgres-lookup";
import {
  createDefaultStoreIdentityLookup,
  type StoreIdentityLookup,
} from "@/lib/store-identity-resolvers";

export async function resolveServerStoreIdentityLookup(options?: {
  identityLookup?: StoreIdentityLookup;
  env?: StoreIdentityEnv;
}): Promise<{
  identityLookup: StoreIdentityLookup;
  env: StoreIdentityEnv;
}> {
  const env = options?.env ?? process.env;
  if (options?.identityLookup) {
    return { identityLookup: options.identityLookup, env };
  }

  const identityLookup = isStoreIdentityExpandEnabled(env)
    ? await createPostgresStoreIdentityLookupSafe()
    : createDefaultStoreIdentityLookup();

  return { identityLookup, env };
}
