import { readdirSync, readFileSync } from "node:fs";
import {
  Adapter,
  DataSourceResource,
  IndexerResource,
  IndexResource,
  MigrationAction,
  MigrationPlan,
  MigrationValidationResult,
  ResourceType,
  ResourceTypes,
} from "./types";
import { migrationFileSchema } from "./schemas";
import path from "node:path";
import { generateMigrationChecksum } from "./checksum";
import chalk from "chalk";
import pluralize from "pluralize";
import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";
import { AnyIndex, AnyIndexer, AnyDataSourceConnection } from "ivy-orm";

/**
 * Ensure the ivy-kit migration history matches the migration
 * history indicated in the migrations directory. Validate:
 *
 * - Migrations directory contains all the applied migrations
 * - Checksums match
 */
export async function validateMigrationHistory({
  adapter,
  migrationsDirectory,
}: {
  adapter: Adapter;
  migrationsDirectory: string;
}): Promise<MigrationValidationResult[]> {
  const stateMigrations = await adapter.listMigrations();

  const migrations = readdirSync(migrationsDirectory);

  const results: MigrationValidationResult[] = [];

  for (const name of migrations) {
    const stateMigration = stateMigrations.find(
      ({ migrationName }) => migrationName === name
    );

    if (!stateMigration) {
      results.push({
        name,
        status: "missingInState",
      });
      continue;
    }

    const localMigration = migrationFileSchema.parse(
      JSON.parse(readFileSync(path.join(migrationsDirectory, name), "utf-8"))
    );

    const checksum = generateMigrationChecksum(localMigration);

    if (checksum !== stateMigration.checksum) {
      results.push({
        name,
        status: "checksumMismatch",
      });
      continue;
    }

    results.push({
      name,
      status: "valid",
    });
  }

  for (const stateMigration of stateMigrations) {
    if (!migrations.some((name) => name === stateMigration.migrationName)) {
      results.push({
        name: stateMigration.migrationName,
        status: "missingLocally",
      });
    }
  }

  return results;
}

/**
 * Helper function to filter the MigrationValidationResult from `validateMigrationHistory` to
 * the migrations that have not yet been applied.
 *
 * @param migrationHistory MigrationValidationResult[]
 * @returns list of unapplied migration names
 */
export function listUnappliedMigrations(
  migrationHistory: MigrationValidationResult[]
): string[] {
  return migrationHistory
    .filter(({ status }) => status === "missingInState")
    .map(({ name }) => name);
}

/**
 * Helper function to filter the MigrationValidationResult from `validateMigrationHistory` to
 * the migrations whose checksums don't match the state checksum.
 *
 * @param migrationHistory MigrationValidationResult[]
 * @returns list of unapplied migration names
 */
export function listMismatchedMigrations(
  migrationHistory: MigrationValidationResult[]
): string[] {
  return migrationHistory
    .filter(({ status }) => status === "checksumMismatch")
    .map(({ name }) => name);
}

/**
 * Helper function to filter the MigrationValidationResult from `validateMigrationHistory` to
 * the migrations that have been applied but are missing in the migrations directory.
 *
 * @param migrationHistory MigrationValidationResult[]
 * @returns list of unapplied migration names
 */
export function listMissingMigrations(
  migrationHistory: MigrationValidationResult[]
): string[] {
  return migrationHistory
    .filter(({ status }) => status === "missingLocally")
    .map(({ name }) => name);
}

/**
 * Checks if there are any issues (checksum mismatches, missigng files) with the `migrationHistory` and aborts if yes.
 *
 * @param migrationHistory
 * @returns
 */
export function ensureValidMigrationHistory(
  migrationHistory: MigrationValidationResult[]
) {
  const mismatchedMigrations = listMismatchedMigrations(migrationHistory);
  const missingMigrations = listMissingMigrations(migrationHistory);

  if (mismatchedMigrations.length > 0) {
    console.log(
      `${chalk.red.bold("Error:")} Checksum mismatmch for ${pluralize("migration", mismatchedMigrations.length)} ${mismatchedMigrations.map((name) => chalk.green(name)).join()}.  Have the local migration files been modified?  Aborting.`
    );
  }

  if (missingMigrations.length > 0) {
    console.log(
      `${chalk.red.bold("Error:")} Missing local migration ${pluralize("file", missingMigrations.length)} for ${pluralize("migration", missingMigrations.length)} ${missingMigrations.map((name) => chalk.green(name)).join()}.  Were the files deleted?  Aborting.`
    );
  }

  if (mismatchedMigrations.length > 0 || missingMigrations.length > 0) {
    process.exit(0);
  }

  return;
}

/**
 * Helper to nudge TypeScript into understanding that the object passed is a member of `MigrationPlan`
 * @param entry
 * @returns MigrationPlan item
 */
function makeMigrationEntry<T extends MigrationPlan[number]>(entry: T): T {
  return entry;
}

export function generateMigrationPlan({
  indexActions,
  indexerActions,
  dataSourceActions,
}: {
  indexActions: MigrationAction<AnyIndex, IndexResource, SearchIndex>;
  indexerActions: MigrationAction<AnyIndexer, IndexerResource, SearchIndexer>;
  dataSourceActions: MigrationAction<
    AnyDataSourceConnection,
    DataSourceResource,
    SearchIndexerDataSourceConnection
  >;
}): MigrationPlan {
  return [
    // delete first
    ...indexerActions.delete.map((resource) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Indexer,
        action: "delete" as const,
        resource,
      })
    ),
    ...dataSourceActions.delete.map((resource) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.DataSource,
        action: "delete" as const,
        resource,
      })
    ),
    ...indexActions.delete.map((resource) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Index,
        action: "delete" as const,
        resource,
      })
    ),
    ...indexActions.update.map(([_, resource]) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Index,
        action: "delete" as const,
        resource,
      })
    ),

    // update next
    ...dataSourceActions.update.map(([resource]) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.DataSource,
        action: "update" as const,
        resource,
      })
    ),
    ...indexerActions.update.map(([resource]) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Indexer,
        action: "update" as const,
        resource,
      })
    ),

    // finally create new
    ...dataSourceActions.create.map((resource) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.DataSource,
        action: "create" as const,
        resource,
      })
    ),
    ...indexActions.update.map(([resource]) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Index,
        action: "create" as const,
        resource,
      })
    ),
    ...indexActions.create.map((resource) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Index,
        action: "create" as const,
        resource,
      })
    ),
    ...indexerActions.create.map((resource) =>
      makeMigrationEntry({
        resourceType: ResourceTypes.Indexer,
        action: "create" as const,
        resource,
      })
    ),
  ];
}

export function printMigrationActions({
  indexActions,
  dataSourceActions,
  indexerActions,
}: {
  indexActions: MigrationAction<AnyIndex, IndexResource, SearchIndex>;
  dataSourceActions: MigrationAction<
    AnyDataSourceConnection,
    DataSourceResource,
    SearchIndexerDataSourceConnection
  >;
  indexerActions: MigrationAction<AnyIndexer, IndexerResource, SearchIndexer>;
}) {
  const printEntry = (
    symbol: string,
    color: chalk.Chalk,
    type: string,
    name: string,
    note?: string
  ) => {
    const typeLabel = chalk.cyanBright(`[${type}]`);
    const nameLabel = chalk.whiteBright(name);
    const extra = note ? ` ${chalk.gray(note)}` : "";
    console.log(`${color(symbol)} ${typeLabel} ${nameLabel}${extra}`);
  };

  // Indexers - delete
  indexerActions.delete.forEach((r) =>
    printEntry("-", chalk.redBright, ResourceTypes.Indexer, r.name)
  );

  // Data Sources - delete
  dataSourceActions.delete.forEach((r) =>
    printEntry("-", chalk.redBright, ResourceTypes.DataSource, r.name)
  );

  // Indexes - delete (for replacement only; skip standalone deletes here)
  const replacedIndexes = new Set(
    indexActions.update.map(([_, state]) => state.name)
  );

  // Indexes - delete (non-replacement)
  indexActions.delete
    .filter((r) => !replacedIndexes.has(r.name))
    .forEach((r) =>
      printEntry("-", chalk.redBright, ResourceTypes.Index, r.name)
    );

  // Data Sources - update
  dataSourceActions.update.forEach(([newRes]) =>
    printEntry("~", chalk.yellowBright, ResourceTypes.DataSource, newRes.name)
  );

  // Indexers - update
  indexerActions.update.forEach(([newRes]) =>
    printEntry("~", chalk.yellowBright, ResourceTypes.Indexer, newRes.name)
  );

  // Indexes - replacements
  indexActions.update.forEach(([newRes]) =>
    printEntry(
      "-/+",
      chalk.magentaBright,
      ResourceTypes.Index,
      newRes.name,
      "(replaced)"
    )
  );

  // Data Sources - create
  dataSourceActions.create.forEach((r) =>
    printEntry("+", chalk.greenBright, ResourceTypes.DataSource, r.name)
  );

  // Indexes - create (excluding ones from update)
  indexActions.create.forEach((r) =>
    printEntry("+", chalk.greenBright, ResourceTypes.Index, r.name)
  );

  // Indexers - create
  indexerActions.create.forEach((r) =>
    printEntry("+", chalk.greenBright, ResourceTypes.Indexer, r.name)
  );
}
