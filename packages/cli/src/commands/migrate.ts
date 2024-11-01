import { command, string } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { ensureAdapter } from "src/util/adapter";
import {
  computeMigrationActions,
  generateMigrationFile,
  ResourceHandlers,
} from "src/migrate/generate";
import { AnyDataSourceConnection, AnyIndex, AnyIndexer } from "ivy-orm";
import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";
import {
  isDataSourceResource,
  isIndexerResource,
  isIndexResource,
} from "src/migrate/guards";
import {
  generateDataSourceChecksum,
  generateIndexChecksum,
  generateIndexerChecksum,
} from "src/migrate/checksum";
import ora from "ora";
import {
  DataSourceResource,
  IndexerResource,
  IndexResource,
} from "src/migrate/types";
import path from "path";
import { format } from "date-fns";
import slugify from "slugify";
import chalk from "chalk";
import { readFileSync, writeFileSync } from "fs";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { ensureMigrationsDirectory } from "src/migrate/util";
import pluralize from "pluralize";
import { migrationFileSchema } from "src/migrate/schemas";
import { Migrator } from "src/migrate/migrator";
import { fetchPendingMigrations } from "src/migrate/plan";

const generateOptions = {
  ...baseOptions,
  name: string()
    .alias("-n")
    .desc("Name the migration")
    .default(
      uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: "-",
      })
    ),
};

const generate = command({
  name: "generate",
  options: generateOptions,
  transform: baseTransform<typeof generateOptions>,
  handler: async ({
    schemaExports: {
      indexes: schemaIndexes,
      indexers: schemaIndexers,
      dataSources: schemaDataSources,
    },
    cwd,
    schema,
    adapter,
    name,
    out,
  }) => {
    ensureAdapter(adapter);

    const spinner = ora("Generating migration...").start();

    // first, ensure there aren't any existing unapplied migrations
    const pendingMigrations = await fetchPendingMigrations({
      adapter,
      migrationsDirectory: ensureMigrationsDirectory(cwd, schema, out),
    });

    if (pendingMigrations.length > 0) {
      spinner.fail();
      console.log(
        `${chalk.red.bold("Error:")} ${pluralize("Migration", pendingMigrations.length)} ${chalk.green(pendingMigrations.join())} ${pendingMigrations.length === 1 ? "has" : "have"} not yet been applied.  Either delete the unapplied ${pluralize("migration", pendingMigrations.length)}, or run ${chalk.green("ivy-kit migrate apply")} before generating a new migration.`
      );

      return;
    }

    const resources = await adapter.listResources();

    const stateIndexes = resources.filter(isIndexResource);
    const stateIndexers = resources.filter(isIndexerResource);
    const stateDataSources = resources.filter(isDataSourceResource);

    const indexHandlers: ResourceHandlers<
      AnyIndex,
      IndexResource,
      SearchIndex
    > = {
      isResource: isIndexResource,
      buildFn: (index) => index["build"](),
      getName: (resource) => resource.name,
      getChecksum: (resource) => resource.checksum,
      generateChecksum: (index) => generateIndexChecksum(index),
      resourceType: "index",
    };

    const indexerHandlers: ResourceHandlers<
      AnyIndexer,
      IndexerResource,
      SearchIndexer
    > = {
      isResource: isIndexerResource,
      buildFn: (indexer) => indexer["build"](),
      getName: (resource) => resource.name,
      getChecksum: (resource) => resource.checksum,
      generateChecksum: (indexer) => generateIndexerChecksum(indexer),
      resourceType: "indexer",
    };

    const dataSourceHandlers: ResourceHandlers<
      AnyDataSourceConnection,
      DataSourceResource,
      SearchIndexerDataSourceConnection
    > = {
      isResource: isDataSourceResource,
      buildFn: (dataSource) => dataSource["build"](),
      getName: (resource) => resource.name,
      getChecksum: (resource) => resource.checksum,
      generateChecksum: (dataSource) => generateDataSourceChecksum(dataSource),
      resourceType: "dataSource",
    };

    const indexActions = computeMigrationActions(
      Object.values(schemaIndexes),
      stateIndexes,
      indexHandlers
    );

    const indexerActions = computeMigrationActions(
      Object.values(schemaIndexers),
      stateIndexers,
      indexerHandlers
    );

    const dataSourceActions = computeMigrationActions(
      Object.values(schemaDataSources),
      stateDataSources,
      dataSourceHandlers
    );

    spinner.stop();

    const migration = generateMigrationFile({
      indexActions,
      indexerActions,
      dataSourceActions,
    });

    if (
      migration.indexes.create.length === 0 &&
      migration.indexes.delete.length === 0 &&
      migration.indexers.create.length === 0 &&
      migration.indexers.delete.length === 0
    ) {
      ora(`No changes to apply.`).succeed();
      return;
    }

    const dir = ensureMigrationsDirectory(cwd, schema, out);
    const filename = `${format(new Date(), "yyyyMMddHHmmss")}-${slugify(
      name
    )}.json`;

    writeFileSync(path.join(dir, filename), JSON.stringify(migration, null, 2));

    ora(`Done! Created migration file ${chalk.green(filename)}`).succeed();
  },
});

const applyOptions = baseOptions;

const apply = command({
  name: "apply",
  options: applyOptions,
  transform: baseTransform<typeof applyOptions>,
  handler: async ({
    adapter,
    out,
    cwd,
    schema,
    searchIndexClient,
    searchIndexerClient,
  }) => {
    ensureAdapter(adapter);

    const ora = (await import("ora")).default;

    const loadingSpinner = ora("Loading migrations...").start();

    const migrationsDirectory = ensureMigrationsDirectory(cwd, schema, out);

    const pendingMigrations = await fetchPendingMigrations({
      adapter,
      migrationsDirectory,
    });

    loadingSpinner.stop();

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations found.");
      return;
    }

    console.log(
      `\n${pendingMigrations.length} ${pluralize("migration", pendingMigrations.length)} found`
    );

    for await (const migrationName of pendingMigrations) {
      const migration = migrationFileSchema.parse(
        JSON.parse(
          readFileSync(path.join(migrationsDirectory, migrationName), "utf-8")
        )
      );

      const migrator = new Migrator({
        name: migrationName,
        migration,
        adapter,
        searchIndexClient,
        searchIndexerClient,
      });

      const { success, message } = await migrator.applyMigration();

      if (!success) {
        console.log(message);
        return;
      }
    }
  },
});

export const migrate = command({
  name: "migrate",
  subcommands: [generate, apply],
});
