import {
  SearchIndex,
  SearchIndexClient,
  SearchIndexer,
  SearchIndexerClient,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";
import {
  generateDataSourceChecksum,
  generateIndexChecksum,
  generateIndexerChecksum,
  generateMigrationChecksum,
} from "./checksum";
import {
  Adapter,
  MigrationFile,
  MigrationPlan,
  Resource,
  ResourceType,
  ResourceTypes,
} from "./types";
import ora from "ora";
import chalk from "chalk";
import { z } from "zod";
import pluralize from "pluralize";
import { resolveSecret } from "./secrets";
import { SecretClient } from "@azure/keyvault-secrets";

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
  updateResource?: (
    client: TClient,
    resource: TCreateResource
  ) => Promise<TCreateResource>;
  stateDeleteResource: (name: string) => Promise<void>;
  stateCreateResource: (resource: TCreateResource) => Promise<Resource>;
  stateUpdateResource?: (
    resource: TCreateResource,
    name: string
  ) => Promise<Resource>;
}

type ApplyMigrationResult =
  | {
      success: true;
      message?: never;
    }
  | {
      success: false;
      message: string;
    };

export class Migrator {
  private migration: MigrationPlan;
  private adapter: Adapter;
  private searchIndexClient: SearchIndexClient;
  private searchIndexerClient: SearchIndexerClient;
  private secretClient?: SecretClient;

  private indexHandlers: ResourceHandlers<SearchIndex, SearchIndexClient> = {
    resourceType: "index",
    getName: (resource) => resource.name,
    getId: (resource) => resource.id,
    getLiveResource: (client, name) => client.getIndex(name),
    deleteResource: (client, name) => client.deleteIndex(name),
    createResource: (client, resource) => client.createIndex(resource),
    stateDeleteResource: (name) =>
      this.adapter.deleteResource(name, "index" as const),
    stateCreateResource: (resource) =>
      this.adapter.createResource({
        name: resource.name,
        type: "index" as const,
        checksum: generateIndexChecksum(resource),
      }),
  };

  private indexerHandlers: ResourceHandlers<
    SearchIndexer,
    SearchIndexerClient
  > = {
    resourceType: "indexer",
    getName: (resource) => resource.name,
    getId: (resource) => resource.id,
    getLiveResource: (client, name) => client.getIndexer(name),
    deleteResource: (client, name) => client.deleteIndexer(name),
    createResource: (client, resource) => client.createIndexer(resource),
    updateResource: (client, resource) =>
      client.createOrUpdateIndexer(resource),
    stateDeleteResource: (name) =>
      this.adapter.deleteResource(name, "indexer" as const),
    stateCreateResource: (resource) =>
      this.adapter.createResource({
        name: resource.name,
        type: "indexer" as const,
        checksum: generateIndexerChecksum(resource),
      }),
    // stateUpdateResource: (resource, name) => this.adapter.updateResource(resource.id, resource)
  };

  private datasourceHandlers: ResourceHandlers<
    SearchIndexerDataSourceConnection,
    SearchIndexerClient
  > = {
    resourceType: "dataSource",
    getName: (resource) => resource.name,
    getId: (resource) => resource.id,
    getLiveResource: (client, name) => client.getDataSourceConnection(name),
    deleteResource: (client, name) => client.deleteDataSourceConnection(name),
    createResource: async (client, resource) => {
      const connectionString = await resolveSecret(
        resource.connectionString,
        this.secretClient
      );
      return client.createDataSourceConnection({
        ...resource,
        connectionString,
      });
    },
    stateDeleteResource: (name) =>
      this.adapter.deleteResource(name, "dataSource" as const),
    stateCreateResource: (resource) =>
      this.adapter.createResource({
        name: resource.name,
        type: "dataSource" as const,
        checksum: generateDataSourceChecksum(resource),
      }),
  };

  // collect functions that could roll-back changes as they're applied
  private rollbackResourcesCollector: Record<
    string,
    {
      rollbackResource: () => Promise<void>;
      rollbackState?: () => Promise<void>;
    }
  > = {};

  constructor({
    name,
    migration,
    adapter,
    searchIndexClient,
    searchIndexerClient,
    secretClient,
  }: {
    name: string;
    migration: MigrationPlan;
    adapter: Adapter;
    searchIndexClient: SearchIndexClient;
    searchIndexerClient: SearchIndexerClient;
    secretClient?: SecretClient;
  }) {
    this.migration = migration;
    this.adapter = adapter;
    this.searchIndexClient = searchIndexClient;
    this.searchIndexerClient = searchIndexerClient;
    this.secretClient = secretClient;
  }

  private getHandlers(resourceType: ResourceTypes) {
    switch (resourceType) {
      case ResourceTypes.Index: {
        return {
          handler: this.indexHandlers,
          client: this.searchIndexClient,
        };
      }

      case ResourceTypes.Indexer: {
        return {
          handler: this.indexerHandlers,
          client: this.searchIndexerClient,
        };
      }

      case ResourceTypes.DataSource: {
        return {
          handler: this.datasourceHandlers,
          client: this.searchIndexerClient,
        };
      }
    }
  }

  async applyMigration(): Promise<ApplyMigrationResult> {
    console.log(`\nApplying updates\n`);

    for await (const { resourceType, action, resource } of this.migration) {
      const { handler, client } = this.getHandlers(resourceType);

      if (action === "delete") {
        await this.processDeleteOperation(client, resource, handler);
      }

      if (action === "create") {
        await this.processCreateOperation(client, resource, handler);
      }

      // if (action === "update") {
      //   this.searchIndexerClient.
      // }
    }

    return {
      success: true,
    };
  }

  private async processDeleteOperation<TClient>(
    client: TClient,
    resource: Omit<Resource, "id">,
    handlers: ResourceHandlers<any, TClient>
  ) {
    const name = handlers.getName(resource);
    const spinner = ora(`Deleting ${handlers.resourceType} ${name}...`).start();

    try {
      await handlers.deleteResource(client, name);

      await handlers.stateDeleteResource(handlers.getName(resource));
      spinner.succeed(`Deleted ${handlers.resourceType} ${name}`);
    } catch (error) {
      spinner.fail();

      console.log(error);
      // await this.errorMigration(JSON.stringify(error));

      process.exit(1);
    }
  }

  private async processCreateOperation<TCreateResource, TClient>(
    client: TClient,
    resource: TCreateResource,
    handlers: ResourceHandlers<TCreateResource, TClient>
  ) {
    const name = handlers.getName(resource);
    const spinner = ora(`Creating ${handlers.resourceType} ${name}...`).start();

    const resourceKey = `${handlers.resourceType}_${handlers.getName(resource)}`;

    try {
      // create the resource in Azure
      await handlers.createResource(client, resource);

      this.rollbackResourcesCollector[resourceKey] = {
        rollbackResource: () =>
          handlers.deleteResource(client, handlers.getName(resource)),
      };
    } catch (error) {
      spinner.fail(
        `${chalk.bold.red("Error:")} failed to create resource ${chalk.green(name)} in Azure.\n\n`
      );

      console.log(error);

      // await this.errorMigration(JSON.stringify(error));
      // await this.rollbackCreatedResources();

      process.exit(1);
    }

    try {
      // add the resource to backend state
      await handlers.stateCreateResource(resource);

      this.rollbackResourcesCollector[resourceKey] = {
        ...this.rollbackResourcesCollector[resourceKey],
        rollbackState: () =>
          handlers.stateDeleteResource(handlers.getName(resource)),
      };

      spinner.succeed(`Created ${handlers.resourceType} ${name}`);
    } catch (error) {
      spinner.fail(
        `${chalk.bold.red("Error:")} failed to save resource ${chalk.green(name)} in state.`
      );

      console.log(error);

      // await this.rollbackCreatedResources();

      process.exit(1);
    }
  }

  private async processUpdateOperation<TCreateResource, TClient>(
    client: TClient,
    resource: TCreateResource,
    handlers: ResourceHandlers<TCreateResource, TClient>
  ) {
    const name = handlers.getName(resource);
    const spinner = ora(`Updating ${handlers.resourceType} ${name}...`).start();

    const resourceKey = `${handlers.resourceType}_${handlers.getName(resource)}`;
  }

  /**
   * In the event of an error, delete all the resources that were created in this migration.
   * TODO: determine how to handle re-creating deleted resources, if at all.
   */
  private async rollbackCreatedResources() {
    const spinner = ora("Attempting to roll back changes...");
    try {
      const results = await Promise.allSettled(
        Object.values(this.rollbackResourcesCollector).map(
          async ({ rollbackResource, rollbackState }) => {
            await rollbackResource();
            await rollbackState?.();
          }
        )
      );

      if (results.filter(({ status }) => status === "rejected").length > 0) {
        spinner.fail();
      }

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Rollback operation ${index} failed:`, result.reason);
        }
      });

      const changeCount = Object.keys(this.rollbackResourcesCollector).length;

      spinner.succeed(
        `Rolled back ${chalk.green(changeCount)} ${pluralize("change", changeCount)}.`
      );
    } catch (e) {
      console.error("Unexpected error during rollback:", e);
    }
  }
}

const errorDetailsSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
