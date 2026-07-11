/**
 * Option A Slice 1 — feature flags for store identity.
 *
 * Master expand and all sub-flags default OFF (including local/dev) until
 * Slice 2 ranking/pantry silent-empty tests are green.
 */

export type StoreIdentityEnv = Record<string, string | undefined>;

function isTruthyEnvFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/** Master: expand alias members on read paths (Settings/map/rank). Default OFF. */
export function isStoreIdentityExpandEnabled(
  env: StoreIdentityEnv = process.env,
): boolean {
  return isTruthyEnvFlag(env.YUM4LESS_STORE_IDENTITY_EXPAND);
}

/** Auto-confirm matches at/above confirmThreshold. Default OFF. */
export function isStoreIdentityAutoConfirmEnabled(
  env: StoreIdentityEnv = process.env,
): boolean {
  return isTruthyEnvFlag(env.YUM4LESS_STORE_IDENTITY_AUTO_CONFIRM);
}

/** Allow SNAP directory rows as match candidates. Default OFF. */
export function isStoreIdentitySnapMatchingEnabled(
  env: StoreIdentityEnv = process.env,
): boolean {
  return isTruthyEnvFlag(env.YUM4LESS_STORE_IDENTITY_SNAP_MATCHING);
}

/** Persist/search-time provisional links. Default OFF. */
export function isStoreIdentitySearchProvisionalEnabled(
  env: StoreIdentityEnv = process.env,
): boolean {
  return isTruthyEnvFlag(env.YUM4LESS_STORE_IDENTITY_SEARCH_PROVISIONAL);
}

export type StoreIdentityFeatureFlags = {
  expandEnabled: boolean;
  autoConfirmEnabled: boolean;
  snapMatchingEnabled: boolean;
  searchProvisionalEnabled: boolean;
};

export function resolveStoreIdentityFeatureFlags(
  env: StoreIdentityEnv = process.env,
): StoreIdentityFeatureFlags {
  return {
    expandEnabled: isStoreIdentityExpandEnabled(env),
    autoConfirmEnabled: isStoreIdentityAutoConfirmEnabled(env),
    snapMatchingEnabled: isStoreIdentitySnapMatchingEnabled(env),
    searchProvisionalEnabled: isStoreIdentitySearchProvisionalEnabled(env),
  };
}
