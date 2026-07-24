/** Ambient types for migration-ledger integration tests importing scripts/*.mjs. */

declare module "@scripts-lib/apply-migrations" {
  export type PostgresMigrationDb = {
    databaseName: string;
    tableExists: (table: string, databaseName?: string) => boolean;
    columnExists: (
      table: string,
      column: string,
      databaseName?: string,
    ) => boolean;
    psqlQueryScalar: (
      sql: string,
      databaseName?: string,
    ) => string | null;
    psqlQueryRows: <T extends Record<string, unknown>>(
      sql: string,
      databaseName?: string,
    ) => T[];
    psqlApplySqlContent: (sql: string, databaseName?: string) => void;
  };

  export function createPostgresMigrationDb(
    databaseName: string,
    helpers: Omit<PostgresMigrationDb, "databaseName">,
  ): PostgresMigrationDb;

  export function listInitMigrationFiles(): string[];

  export function applyPendingMigrations(
    db: PostgresMigrationDb,
    options?: { stopAfterVersion?: string },
  ): { applied: string[]; skipped: string[]; backfilled: string[] };

  export function migrationEffectPresent(
    version: string,
    db: PostgresMigrationDb,
  ): boolean;

  export function identitySeedEffectPresent(
    db: PostgresMigrationDb,
    spec: {
      identityId: string;
      canonicalStoreId: string;
      aliasStoreId: string;
      memberStoreIds: [string, string];
    },
  ): boolean;

  export function assertIdentitySeedEffectAfterApply(
    version: string,
    db: PostgresMigrationDb,
  ): void;

  export const IDENTITY_SEED_SPECS: Record<
    string,
    {
      version: string;
      identityId: string;
      canonicalStoreId: string;
      aliasStoreId: string;
      memberStoreIds: [string, string];
    }
  >;
}

declare module "@scripts-lib/spawn-safe" {
  /** Homelab ingest container: TCP `psql` instead of `docker exec`. */
  export function isExternalPostgresMode(): boolean;

  /** Rewrite DATABASE_URL pathname to the given database for host `psql`. */
  export function resolveExternalConnectionUrl(databaseName: string): string;

  export function tableExists(
    table: string,
    databaseName?: string,
  ): boolean;

  export function columnExists(
    table: string,
    column: string,
    databaseName?: string,
  ): boolean;

  export function createDatabase(databaseName: string): void;

  export function dropDatabaseIfExists(databaseName: string): void;

  export function psqlApplySqlContent(
    sql: string,
    databaseName?: string,
  ): void;

  export function psqlQueryRows<T extends Record<string, unknown>>(
    sql: string,
    databaseName?: string,
  ): T[];

  export function psqlQueryScalar(
    sql: string,
    databaseName?: string,
  ): string | null;

  export function assertSafeSqlIdentifier(
    value: string,
    label?: string,
  ): string;
}
