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
}

declare module "@scripts-lib/spawn-safe" {
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
