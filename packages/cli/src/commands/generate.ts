import { command, string } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { AnyIndex, AnyIndexer } from "ivy-orm";
import {
  ensureMigrationsDirectory,
  IndexerResource,
  IndexResource,
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
import { generateChecksum } from "src/util/checksum";
import { SearchIndex, SearchIndexer } from "@azure/search-documents";

/**
 * 1. fetch all existing indexes
 * 2. compare existing index etags against stored - any discrepancies represent an index that needs to be redeployed
 * 3. compare all schema indexes against the version in its latest migration.  differences represent an index that needs to be redeployed.
 */

/**
 * compare indexes in the schema vs. stored state.
 *  -> indexes in state not in schema need to be deleted from Azure
 *  -> indexes not in state in schema need to be created in Azure
 */

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

export const generate = command({
  name: "generate",
  desc: "Create a migration file that can be used to apply migrations locally or in release pipelines.",
  options,
  transform: baseTransform<typeof options>,
  handler: async ({
    adapter,
    schemaExports: { indexes: schemaIndexes, indexers: schemaIndexers },
    out,
    cwd,
    schema,
    name,
  }) => {
    const ora = (await import("ora")).default;

    const spinner = ora("Generating migration...").start();
    // const indexIterator = searchIndexClient.listIndexes();

    // const azureIndexes = [];
    // for await (const index of indexIterator) {
    //   azureIndexes.push(index);
    // }

    // check for etag differences

    const resources = await adapter.listResources();

    const stateIndexes = resources.filter((i) => isIndexResource(i));
    const stateIndexers = resources.filter((i) => isIndexerResource(i));

    // find indexes that exist in schema but not in state
    const createIndexes: AnyIndex[] = _.differenceBy(
      Object.values(schemaIndexes),
      stateIndexes,
      "name"
    );

    // find indexes that exist in state but not schema
    const deleteIndexes: IndexResource[] = _.differenceBy(
      stateIndexes,
      Object.values(schemaIndexes),
      "name"
    );

    // find indexers that exist in schema but not in state
    const createIndexers: AnyIndexer[] = _.differenceBy(
      Object.values(schemaIndexers),
      stateIndexers,
      "name"
    );

    // find indexers that exist in state but not schema
    const deleteIndexers: IndexerResource[] = _.differenceBy(
      stateIndexers,
      Object.values(schemaIndexers),
      "name"
    );

    const modifiedIndexes = _.intersectionBy(
      Object.values(schemaIndexes),
      stateIndexes,
      "name"
    )
      .filter((idx) => {
        const checksum = generateChecksum(JSON.stringify(idx["build"]()));
        const savedChecksum = stateIndexes.find(
          ({ name }) => name === idx.name
        )?.checksum;

        if (!savedChecksum)
          throw new Error(
            `${chalk.red.bold("Error:")} Unexpectedly missing checksum for index ${idx.name}.`
          );

        return checksum !== savedChecksum;
      })
      .map((idx) => {
        const stateIndex = stateIndexes.find(({ name }) => name === idx.name);
        return [idx["build"](), stateIndex] as [SearchIndex, IndexResource];
      });

    const deleteIndexesForUpdate: IndexResource[] = modifiedIndexes.map(
      ([_, index]) => index
    );

    const createIndexesForUpdate: SearchIndex[] = modifiedIndexes.map(
      ([searchIndex]) => searchIndex
    );

    const modifiedIndexers: [SearchIndexer, IndexerResource][] =
      _.intersectionBy(Object.values(schemaIndexers), stateIndexers, "name")
        .filter((idxr) => {
          const checksum = generateChecksum(JSON.stringify(idxr["build"]()));
          const savedChecksum = stateIndexers.find(
            ({ name }) => name === idxr.name
          )?.checksum;

          if (!savedChecksum)
            throw new Error(
              `${chalk.red.bold("Error:")} Unexpectedly missing checksum for index ${idxr.name}.`
            );

          return checksum !== savedChecksum;
        })
        .map((idxr) => {
          const stateIndexer = stateIndexers.find(
            ({ name }) => name === idxr.name
          );
          return [idxr["build"](), stateIndexer] as [
            SearchIndexer,
            IndexerResource,
          ];
        });

    const deleteIndexersForUpdate: IndexerResource[] = modifiedIndexers.map(
      ([_, indexer]) => indexer
    );

    const createIndexersForUpdate: SearchIndexer[] = modifiedIndexers.map(
      ([searchIndexer]) => searchIndexer
    );

    spinner.stop();

    const migration: MigrationFile = {
      indexes: {
        create: [
          ...createIndexes.map((idx) => idx["build"]()),
          ...createIndexesForUpdate,
        ],
        delete: [...deleteIndexes, ...deleteIndexesForUpdate],
      },
      indexers: {
        create: [
          ...createIndexers.map((idxr) => idxr["build"]()),
          ...createIndexersForUpdate,
        ],
        delete: [...deleteIndexers, ...deleteIndexersForUpdate],
      },
    };

    if (
      migration.indexes.create.length === 0 &&
      migration.indexes.delete.length === 0 &&
      migration.indexers.create.length === 0 &&
      migration.indexers.delete.length === 0
    ) {
      ora(`No changes to apply.`).succeed();
      process.exit(0);
    }

    const dir = ensureMigrationsDirectory(cwd, schema, out);
    const filename = `${format(new Date(), "yyyyMMddHHmmss")}-${slugify(name)}.json`;

    writeFileSync(path.join(dir, filename), JSON.stringify(migration, null, 2));

    ora(`Done! Created migration file ${chalk.green(filename)}`).succeed();

    if (
      migration.indexes.create.length > 0 ||
      migration.indexes.delete.length > 0
    ) {
      console.log(`\n${chalk.cyan("indexes:")}`);
      migration.indexes.delete.forEach(({ name }) => {
        console.log(`  ${chalk.redBright("-")} ${name}`);
      });

      migration.indexes.create.forEach(({ name }) => {
        console.log(
          `  ${chalk.greenBright("+")} ${name} ${createIndexesForUpdate.findIndex(({ name }) => name === name) !== -1 ? chalk.gray("(modified)") : ""}`
        );
      });
    }

    if (
      migration.indexers.create.length > 0 ||
      migration.indexers.delete.length > 0
    ) {
      console.log(`\n${chalk.cyan("indexers:")}`);
      migration.indexers.delete.forEach(({ name }) => {
        console.log(`  ${chalk.redBright("-")} ${name}`);
      });

      migration.indexers.create.forEach(({ name }) => {
        console.log(
          `  ${chalk.greenBright("+")} ${name} ${createIndexersForUpdate.findIndex(({ name }) => name === name) !== -1 ? chalk.gray("(modified)") : ""}`
        );
      });
    }
  },
});
