import { command, string } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { AnyDataSourceConnection, AnyIndex, AnyIndexer } from "ivy-orm";
import {
  DataSourceResource,
  ensureMigrationsDirectory,
  IndexerResource,
  IndexResource,
  isDataSourceResource,
  isIndexerResource,
  isIndexResource,
  MigrationFile,
} from "src/util/migrate";
import path from "path";
import { writeFileSync } from "fs";
import { format } from "date-fns";
import _ from "lodash";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import slugify from "slugify";
import chalk from "chalk";
import {
  generateDataSourceChecksum,
  generateIndexChecksum,
  generateIndexerChecksum,
} from "src/util/checksum";
import { ensureAdapter } from "src/util/adapter";
import ora from "ora";
import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";

const options = {
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

type ResourceType = "index" | "indexer" | "dataSource";

interface ResourceHandlers<TSchema, TState, TBuilt> {
  /**
   * type guard function
   */
  isResource: (resource: any) => resource is TState;

  buildFn: (schemaResource: TSchema) => TBuilt;

  /**
   * function that returns the name of the resource stored in ivy-kit state
   */
  getName: (resource: TSchema | TState) => string;

  /**
   * function that returns the checksum of the resource stored in ivy-kit state
   */
  getChecksum: (resource: TState) => string;

  generateChecksum: (built: TBuilt) => string;

  resourceType: ResourceType;
}

function computeMigrationActions<TSchema, TState, TBuilt>(
  schemaResources: TSchema[],
  stateResources: TState[],
  handlers: ResourceHandlers<TSchema, TState, TBuilt>
) {
  const { buildFn, getName, getChecksum } = handlers;

  const create = _.differenceBy(schemaResources, stateResources, getName);
  const toDelete = _.differenceBy(stateResources, schemaResources, getName);

  const modified = _.intersectionBy(schemaResources, stateResources, getName)
    // filter to resources whose checksum doesn't match that stored in state
    .filter((schemaResource) => {
      const name = getName(schemaResource);
      const builtResource = buildFn(schemaResource);
      const checksum = handlers.generateChecksum(builtResource);

      const stateResource = stateResources.find((sr) => getName(sr) === name);

      if (!stateResource) {
        throw new Error(
          `${chalk.red.bold("Error:")} State resource not found for ${name}.`
        );
      }

      const savedChecksum = getChecksum(stateResource);

      if (!savedChecksum) {
        throw new Error(
          `${chalk.red.bold("Error:")} Missing checksum for resource ${name}.`
        );
      }

      return checksum !== savedChecksum;
    })
    // "link" the schema resource to the associated out-of-date resource in the state
    .map((schemaResource) => {
      const stateResource = stateResources.find(
        (sr) => getName(sr) === getName(schemaResource)
      );
      return [buildFn(schemaResource), stateResource] as [TBuilt, TState];
    });

  return {
    create,
    delete: toDelete,
    update: modified,
  };
}

function displayMigrationChanges(
  migrationPart: { create: any[]; delete: any[] },
  resourceType: ResourceType,
  updatedResources: any[]
) {
  if (migrationPart.create.length > 0 || migrationPart.delete.length > 0) {
    console.log(`\n${chalk.cyan(`${resourceType}s:`)}`);

    migrationPart.delete.forEach(({ name }: { name: string }) => {
      console.log(`  ${chalk.redBright("-")} ${name}`);
    });

    migrationPart.create.forEach(({ name }: { name: string }) => {
      const isModified = updatedResources.some(
        (resource) => resource.name === name
      );
      console.log(
        `  ${chalk.greenBright("+")} ${name} ${
          isModified ? chalk.gray("(modified)") : ""
        }`
      );
    });
  }
}

export const generate = command({
  name: "generate",
  desc: "Create a migration file that can be used to apply migrations locally or in release pipelines.",
  options,
  transform: baseTransform<typeof options>,
  handler: async ({
    adapter,
    schemaExports: {
      indexes: schemaIndexes,
      indexers: schemaIndexers,
      dataSources: schemaDataSources,
    },
    out,
    cwd,
    schema,
    name,
  }) => {
    ensureAdapter(adapter);

    const spinner = ora("Generating migration...").start();

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

    const migration: MigrationFile = {
      indexes: {
        create: [
          ...indexActions.create.map((idx) => idx["build"]()),
          ...indexActions.update.map(([built]) => built),
        ],
        delete: [
          ...indexActions.delete,
          ...indexActions.update.map(([, state]) => state),
        ],
      },
      indexers: {
        create: [
          ...indexerActions.create.map((idxr) => idxr["build"]()),
          ...indexerActions.update.map(([built]) => built),
        ],
        delete: [
          ...indexerActions.delete,
          ...indexerActions.update.map(([, state]) => state),
        ],
      },
      dataSources: {
        create: [
          ...dataSourceActions.create.map((src) => src["build"]()),
          ...dataSourceActions.update.map(([built]) => built),
        ],
        delete: [
          ...dataSourceActions.delete,
          ...dataSourceActions.update.map(([, state]) => state),
        ],
      },
    };

    if (
      migration.indexes.create.length === 0 &&
      migration.indexes.delete.length === 0 &&
      migration.indexers.create.length === 0 &&
      migration.indexers.delete.length === 0
    ) {
      ora(`No changes to apply.`).succeed();
      return; // Return early instead of process.exit(0)
    }

    const dir = ensureMigrationsDirectory(cwd, schema, out);
    const filename = `${format(new Date(), "yyyyMMddHHmmss")}-${slugify(
      name
    )}.json`;

    writeFileSync(path.join(dir, filename), JSON.stringify(migration, null, 2));

    ora(`Done! Created migration file ${chalk.green(filename)}`).succeed();

    displayMigrationChanges(
      migration.indexes,
      "index",
      indexActions.update.map(([built]) => built)
    );

    displayMigrationChanges(
      migration.indexers,
      "indexer",
      indexerActions.update.map(([built]) => built)
    );

    displayMigrationChanges(
      migration.dataSources,
      "dataSource",
      dataSourceActions.update.map(([built]) => built)
    );
  },
});
