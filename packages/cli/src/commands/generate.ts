import { command, string } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { dataSource, isIndexer } from "ivy-orm";
import {
  Adapter,
  ensureMigrationsDirectory,
  isIndexerResource,
  isIndexResource,
  MigrationFile,
  Resource,
} from "src/util/migrate";
import path from "path";
import { writeFile, writeFileSync } from "fs";
import { format } from "date-fns";
import _ from "lodash";
import { SearchIndex, SearchIndexer } from "@azure/search-documents";
import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
import slugify from "slugify";
import chalk from "chalk";

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

async function listIndexNamesInState(adapater: Adapter) {
  const resources = await adapater.listResources();
  return resources
    .filter(({ type }) => type === "index")
    .map(({ name }) => name);
}

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
    searchIndexClient,
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

    const stateIndexNames = await listIndexNamesInState(adapter);

    const resources = await adapter.listResources();

    const stateIndexes = resources.filter((i) => isIndexResource(i));
    const stateIndexers = resources.filter((i) => isIndexerResource(i));

    // find indexes that exist in schema but not in state
    const createIndexes = _.differenceBy(
      Object.values(schemaIndexes),
      stateIndexes,
      "name"
    );

    const deleteIndexes = _.differenceBy(
      stateIndexes,
      Object.values(schemaIndexes),
      "name"
    );

    const createIndexers = _.differenceBy(
      Object.values(schemaIndexers),
      stateIndexers,
      "name"
    );

    const deleteIndexers = _.differenceBy(
      stateIndexers,
      Object.values(schemaIndexers),
      "name"
    );

    spinner.stop();

    const migration: MigrationFile = {
      indexes: {
        create: createIndexes.map((idx) => idx["build"]()),
        delete: deleteIndexes,
      },
      indexers: {
        create: createIndexers.map((idxr) => idxr["build"]()),
        delete: deleteIndexers,
      },
    };

    const dir = ensureMigrationsDirectory(cwd, schema, out);
    const filename = `${format(new Date(), "yyyyMMddHHmmss")}-${slugify(name)}.json`;

    writeFileSync(path.join(dir, filename), JSON.stringify(migration));

    ora(`Done! Created migration file ${chalk.green(filename)}`).succeed();
  },
});
