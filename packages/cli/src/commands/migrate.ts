import { command } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { readdirSync, readFileSync } from "fs";
import {
  ensureMigrationsDirectory,
  migrationFileSchema,
  Resource,
} from "src/util/migrate";
import path from "path";
import chalk from "chalk";
import pluralize from "pluralize";
import {
  generateIndexChecksum,
  generateIndexerChecksum,
} from "src/util/checksum";
import { ensureAdapter } from "src/util/adapter";
import {
  SearchIndex,
  SearchIndexClient,
  SearchIndexer,
  SearchIndexerClient,
} from "@azure/search-documents";

type ResourceType = "index" | "indexer" | "dataSource";

interface ResourceHandlers<TCreateResource, TClient> {
  resourceType: ResourceType;
  getName: (resource: TCreateResource | Resource) => string;
  getId: (resource: Resource) => string;
  getLiveResource: (client: TClient, name: string) => Promise<TCreateResource>;
  deleteResource: (client: TClient, name: string) => Promise<void>;
  createResource: (
    client: TClient,
    resource: TCreateResource
  ) => Promise<TCreateResource>;
  stateDeleteResource: (id: string) => Promise<void>;
  stateCreateResource: (resource: TCreateResource) => Promise<Resource>;
}

async function processDeleteOperations<TClient>(
  client: TClient,
  resources: Resource[],
  handlers: ResourceHandlers<any, TClient>
) {
  const ora = (await import("ora")).default;

  for (const resource of resources) {
    const name = handlers.getName(resource);
    const spinner = ora(`Deleting ${handlers.resourceType} ${name}...`).start();
    try {
      await handlers.deleteResource(client, name);
      await handlers.stateDeleteResource(handlers.getId(resource));
      spinner.succeed(`Deleted ${handlers.resourceType} ${name}`);
    } catch (error) {
      spinner.fail();
      throw error;
    }
  }
}

async function processCreateOperations<TCreateResource, TClient>(
  client: TClient,
  resources: TCreateResource[],
  handlers: ResourceHandlers<TCreateResource, TClient>
) {
  const ora = (await import("ora")).default;

  for (const resource of resources) {
    const name = handlers.getName(resource);
    const spinner = ora(`Creating ${handlers.resourceType} ${name}...`).start();
    try {
      await handlers.createResource(client, resource);

      await handlers.stateCreateResource(resource);
      spinner.succeed(`Created ${handlers.resourceType} ${name}`);
    } catch (error) {
      spinner.fail();
      throw error;
    }
  }
}

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
    ensureAdapter(adapter);

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
      return;
    }

    console.log(
      `\n${pendingMigrations.length} ${pluralize("migration", pendingMigrations.length)} found`
    );

    for await (const migrationName of pendingMigrations) {
      const migration = migrationFileSchema.parse(
        JSON.parse(
          readFileSync(path.join(migrationDirectory, migrationName), "utf-8")
        )
      );

      console.log(`\nApplying migration \`${chalk.green(migrationName)}\`\n`);

      const indexHandlers: ResourceHandlers<SearchIndex, SearchIndexClient> = {
        resourceType: "index",
        getName: (resource) => resource.name,
        getId: (resource) => resource.id,
        getLiveResource: (client, name) => client.getIndex(name),
        deleteResource: (client, name) => client.deleteIndex(name),
        createResource: (client, resource) => client.createIndex(resource),
        stateDeleteResource: (id) => adapter.deleteResource(id),
        stateCreateResource: (resource) =>
          adapter.createResource({
            name: resource.name,
            type: "index",
            checksum: generateIndexChecksum(resource),
          }),
      };

      await processDeleteOperations(
        searchIndexClient,
        migration.indexes.delete,
        indexHandlers
      );

      await processCreateOperations(
        searchIndexClient,
        migration.indexes.create,
        indexHandlers
      );

      const indexerHandlers: ResourceHandlers<
        SearchIndexer,
        SearchIndexerClient
      > = {
        resourceType: "index",
        getName: (resource) => resource.name,
        getId: (resource) => resource.id,
        getLiveResource: (client, name) => client.getIndexer(name),
        deleteResource: (client, name) => client.deleteIndexer(name),
        createResource: async (client, resource) => {
          const res = await client.createIndexer(resource);
          console.log("CREATED INDEXER W/ ETAG", res.etag);
          return res;
        },
        stateDeleteResource: (id) => adapter.deleteResource(id),
        stateCreateResource: (resource) =>
          adapter.createResource({
            name: resource.name,
            type: "indexer",
            checksum: generateIndexerChecksum(resource),
          }),
      };

      await processDeleteOperations(
        searchIndexerClient,
        migration.indexers.delete,
        indexerHandlers
      );

      await processCreateOperations(
        searchIndexerClient,
        migration.indexers.create,
        indexerHandlers
      );

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
