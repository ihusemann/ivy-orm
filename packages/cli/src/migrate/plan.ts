import { readdirSync } from "node:fs";
import { Adapter } from "./types";
import { ensureMigrationsDirectory } from "./util";

/**
 * Fetch the migrations that have not yet been applied
 * (aka migrations that are in the migrations directory but missing from the ivy-kit state)
 * @returns list of names of the pending migration files
 */
export async function fetchPendingMigrations({
  adapter,
  migrationsDirectory,
}: {
  adapter: Adapter;
  migrationsDirectory: string;
}): Promise<string[]> {
  const stateMigrations = await adapter.listMigrations();

  const migrations = readdirSync(migrationsDirectory);

  // filter migrations from migrations directory to only those that are not in state (have not been applied)
  return migrations.filter(
    (name) =>
      !stateMigrations.some(({ migrationName }) => migrationName === name)
  );
}
