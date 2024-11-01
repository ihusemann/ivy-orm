import { readdirSync, readFileSync } from "node:fs";
import { Adapter, MigrationValidationResult } from "./types";
import { migrationFileSchema } from "./schemas";
import path from "node:path";
import { generateMigrationChecksum } from "./checksum";
import chalk from "chalk";
import pluralize from "pluralize";

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
