import {
  SearchIndex,
  SearchIndexClient,
  SearchIndexer,
  SearchIndexerClient,
} from "@azure/search-documents";
import {
  generateIndexChecksum,
  generateIndexerChecksum,
  generateMigrationChecksum,
} from "./checksum";
import { Adapter, MigrationFile, Resource, ResourceType } from "./types";
import ora from "ora";
import chalk from "chalk";
import { isRestError } from "@azure/core-rest-pipeline";
import { z } from "zod";

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
  private id?: string; // assigned a value once the migration is started
  private name: string;
  private migration: MigrationFile;
  private adapter: Adapter;
  private searchIndexClient: SearchIndexClient;
  private searchIndexerClient: SearchIndexerClient;

  private indexHandlers: ResourceHandlers<SearchIndex, SearchIndexClient> = {
    resourceType: "index",
    getName: (resource) => resource.name,
    getId: (resource) => resource.id,
    getLiveResource: (client, name) => client.getIndex(name),
    deleteResource: (client, name) => client.deleteIndex(name),
    createResource: (client, resource) => client.createIndex(resource),
    stateDeleteResource: (id) => this.adapter.deleteResource(id),
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
    stateDeleteResource: (id) => this.adapter.deleteResource(id),
    stateCreateResource: (resource) =>
      this.adapter.createResource({
        name: resource.name,
        type: "indexer" as const,
        checksum: generateIndexerChecksum(resource),
      }),
  };

  constructor({
    name,
    migration,
    adapter,
    searchIndexClient,
    searchIndexerClient,
  }: {
    name: string;
    migration: MigrationFile;
    adapter: Adapter;
    searchIndexClient: SearchIndexClient;
    searchIndexerClient: SearchIndexerClient;
  }) {
    this.name = name;
    this.migration = migration;
    this.adapter = adapter;
    this.searchIndexClient = searchIndexClient;
    this.searchIndexerClient = searchIndexerClient;
  }

  private async startMigration() {
    const checksum = generateMigrationChecksum(this.migration);

    const migration = await this.adapter.startMigration({
      migrationName: this.name,
      checksum,
    });

    this.id = migration.id;

    return migration;
  }

  async applyMigration(): Promise<ApplyMigrationResult> {
    console.log(`\nApplying migration \`${chalk.green(this.name)}\`\n`);

    const migration = await this.startMigration();

    // INDEXES
    try {
      await this.processDeleteOperations(
        this.searchIndexClient,
        this.migration.indexes.delete,
        this.indexHandlers
      );
    } catch (e) {
      // TODO: don't error for delete errors?  How to check for 404?
      this.errorMigration(JSON.stringify(e));
      return {
        success: false,
        message: JSON.stringify(e),
      };
    }

    try {
      await this.processCreateOperations(
        this.searchIndexClient,
        this.migration.indexes.create,
        this.indexHandlers
      );
    } catch (e) {
      this.errorMigration(JSON.stringify(e));
      return {
        success: false,
        message: JSON.stringify(e),
      };
    }

    // INDEXERS
    try {
      await this.processDeleteOperations(
        this.searchIndexerClient,
        this.migration.indexers.delete,
        this.indexerHandlers
      );
    } catch (e) {
      // TODO: don't error for delete errors?  How to check for 404?
      this.errorMigration(JSON.stringify(e));
      return {
        success: false,
        message: JSON.stringify(e),
      };
    }

    try {
      await this.processCreateOperations(
        this.searchIndexerClient,
        this.migration.indexers.create,
        this.indexerHandlers
      );
    } catch (e) {
      this.errorMigration(JSON.stringify(e));
      return {
        success: false,
        message: JSON.stringify(e),
      };
    }

    try {
      await this.succeedMigration();
    } catch (e) {
      return {
        success: false,
        message: "Migration succeeded, but failed to write to state.",
      };
    }

    return {
      success: true,
    };
  }

  private async succeedMigration() {
    if (!this.id) return;

    return this.adapter.succeedMigration(this.id);
  }

  private async errorMigration(error: string) {
    if (!this.id) return;

    return this.adapter.errorMigration(this.id, error);
  }

  private async processDeleteOperations<TClient>(
    client: TClient,
    resources: Resource[],
    handlers: ResourceHandlers<any, TClient>
  ) {
    for (const resource of resources) {
      const name = handlers.getName(resource);
      const spinner = ora(
        `Deleting ${handlers.resourceType} ${name}...`
      ).start();
      try {
        await handlers.deleteResource(client, name);
        await handlers.stateDeleteResource(handlers.getId(resource));
        spinner.succeed(`Deleted ${handlers.resourceType} ${name}`);
      } catch (error) {
        spinner.fail();
        if (isRestError(error)) {
          const results = errorDetailsSchema.safeParse(error.details);
          if (!results.success)
            throw new Error(`${error.code || "Unknown error"}`);
          const {
            error: { code, message },
          } = results.data;
          throw new Error(`${code}: ${message}`);
        }

        throw error;
      }
    }
  }

  private async processCreateOperations<TCreateResource, TClient>(
    client: TClient,
    resources: TCreateResource[],
    handlers: ResourceHandlers<TCreateResource, TClient>
  ) {
    for (const resource of resources) {
      const name = handlers.getName(resource);
      const spinner = ora(
        `Creating ${handlers.resourceType} ${name}...`
      ).start();
      try {
        await handlers.createResource(client, resource);

        await handlers.stateCreateResource(resource);

        spinner.succeed(`Created ${handlers.resourceType} ${name}`);
      } catch (error) {
        spinner.fail();

        if (isRestError(error)) {
          const results = errorDetailsSchema.safeParse(error.details);
          if (!results.success)
            throw new Error(`${error.code || "Unknown error"}`);
          const {
            error: { code, message },
          } = results.data;
          throw new Error(`${code}: ${message}`);
        }

        throw error;
      }
    }
  }
}

const errorDetailsSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

/**
 * Ensure the ivy-kit migration history matches the migration
 * history indicated in the migrations directory. Validate:
 *
 * - Migrations directory contains all the applied migrations
 * - Checksums match
 */
async function validateMigrationHistory() {}
