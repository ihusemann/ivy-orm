import { command } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { readdirSync, readFileSync } from "fs";
import {
  ensureETagsMatch,
  ensureMigrationsDirectory,
  migrationFileSchema,
} from "src/util/migrate";
import path from "path";
import chalk from "chalk";
import pluralize from "pluralize";
import { generateChecksum } from "src/util/checksum";

export const migrate = command({
  name: "migrate",
  options: baseOptions,
  transform: baseTransform<{}>,
  handler: async ({
    adapter,
    cwd,
    schema,
    out,
    searchIndexClient,
    searchIndexerClient,
  }) => {
    const ora = (await import("ora")).default;

    const loadingSpinner = ora("Loading migrations...").start();
    // find unapplied migrations
    const appliedMigrations = new Set(
      (await adapter.listAppliedMigrations()).map(({ name }) => name)
    );

    loadingSpinner.stop();

    const migrationDirectory = ensureMigrationsDirectory(cwd, schema, out);

    const migrations = readdirSync(migrationDirectory);

    const pendingMigrations = migrations.filter(
      (name) => !appliedMigrations.has(name)
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations found.  Aborting.");
      process.exit(0);
    }

    console.log(
      `\n${pendingMigrations.length} ${pluralize("migrations", pendingMigrations.length)} found`
    );

    for await (const migrationName of pendingMigrations) {
      const migration = migrationFileSchema.parse(
        JSON.parse(
          readFileSync(path.join(migrationDirectory, migrationName), "utf-8")
        )
      );

      console.log(`\nApplying migration \`${chalk.green(migrationName)}\`\n`);

      for await (const index of migration.indexes.delete) {
        const spinner = ora(`Deleting index ${index.name}...`).start();
        const liveIndex = await searchIndexClient.getIndex(index.name);

        if (!ensureETagsMatch(liveIndex.etag, index.etag)) {
          spinner.fail();
          throw new Error(
            `${chalk.red.bold("Error:")} could not delete index ${index.name} due to etag mismatch.`
          );
        }

        await searchIndexClient.deleteIndex(index.name);

        await adapter.deleteResource(index.id);
        spinner.text = `Deleted index ${index.name}`;
        spinner.succeed();
      }

      for await (const index of migration.indexes.create) {
        const spinner = ora(`Creating index ${index.name}`).start();
        const createdIndex = await searchIndexClient.createIndex(index);

        if (!createdIndex.etag) {
          spinner.fail();
          throw new Error(
            `${chalk.bold.red("Error:")} did not receive etag from AI Search.`
          );
        }

        await adapter.createResource({
          name: index.name,
          type: "index",
          etag: createdIndex.etag,
          checksum: generateChecksum(JSON.stringify(index)),
        });

        spinner.text = `Created index ${index.name}`;
        spinner.succeed();
      }

      for await (const indexer of migration.indexers.delete) {
        const spinner = ora(`Deleting indexer ${indexer.name}...`).start();
        const liveIndexer = await searchIndexerClient.getIndexer(indexer.name);

        if (!ensureETagsMatch(liveIndexer.etag, indexer.etag)) {
          spinner.fail();
          throw new Error(
            `${chalk.red.bold("Error:")} could not delete index ${indexer.name} due to etag mismatch.`
          );
        }

        await searchIndexerClient.deleteIndexer(indexer.name);

        await adapter.deleteResource(indexer.id);
        spinner.text = `Deleted index ${indexer.name}`;
        spinner.succeed();
      }

      for await (const indexer of migration.indexers.create) {
        const spinner = ora(`Creating indexer ${indexer.name}`).start();
        const createdIndexer = await searchIndexerClient.createIndexer(indexer);

        if (!createdIndexer.etag) {
          spinner.fail();
          throw new Error(
            `${chalk.bold.red("Error:")} did not receive etag from AI Search.`
          );
        }

        await adapter.createResource({
          name: indexer.name,
          type: "indexer",
          etag: createdIndexer.etag,
          checksum: generateChecksum(JSON.stringify(indexer)),
        });

        spinner.text = `Created indexer ${indexer.name}`;
        spinner.succeed();
      }

      try {
        await adapter.applyMigration(migrationName);
      } catch {
        throw new Error(
          `${chalk.red.bold("Error:")} migration was successful, but was not added to migration history.`
        );
      }
    }

    ora("Done!").succeed();
  },
});
