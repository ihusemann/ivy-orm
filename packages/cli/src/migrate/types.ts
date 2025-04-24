import { z } from "zod";
import {
  indexResourceSchema,
  indexerResourceSchema,
  dataSourceResourceSchema,
  migrationFileSchema,
} from "./schemas";
import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";
import { AnyIndex, AnyIndexer, AnyDataSourceConnection } from "ivy-orm";

/**
 * Type of the state that stores the status of migrations.
 */
export type Migration = {
  /**
   * Randomly generated ID for the migration.  Ideally a v4 UUID.
   */
  id: string;

  /**
   * The complete name of the migration directory.
   *
   * @example `20241002131556-imperial-dragonfly.json`
   */
  migrationName: string;

  /**
   * The sha256 checksum of the migration file at the time the migration is applied.  Should never be overwritten.
   */
  checksum: string;

  /**
   * The timestamp at which the migration is started.  Written prior to any migration actions.
   */
  startedAt: Date;

  /**
   * The timestamp at which the migration successfully completed.  A non-null value indicates the migration succeeded.
   */
  finishedAt?: Date | null;

  /**
   * Any error messages that occurred during teh migration
   */
  logs?: string | null;
};

export type ResourceType = "index" | "indexer" | "dataSource";

export enum ResourceTypes {
  Index = "index",
  Indexer = "indexer",
  DataSource = "dataSource",
}

export type IndexResource = z.infer<typeof indexResourceSchema>;

export type IndexerResource = z.infer<typeof indexerResourceSchema>;

export type DataSourceResource = z.infer<typeof dataSourceResourceSchema>;

export type Resource = IndexResource | IndexerResource | DataSourceResource;

export type MigrationFile = z.infer<typeof migrationFileSchema>;

export type StartMigrationArgs = Pick<Migration, "migrationName" | "checksum">;

export interface Adapter {
  /**
   * If defined, runs before commands that interact with backend state.
   * Can be used to ensure backend provider is ready.
   */
  initialize?(): Promise<void>;
  listResources(): Promise<Resource[]>;
  updateResource(id: string, data: Partial<Resource>): Promise<void>;
  createResource(data: Omit<Resource, "id">): Promise<Resource>;
  deleteResource(name: string, type: ResourceType): Promise<void>;

  listMigrations(): Promise<Migration[]>;
  startMigration(migration: StartMigrationArgs): Promise<Migration>;
  succeedMigration(id: string): Promise<Migration>;
  errorMigration(id: string, error: string): Promise<Migration>;
}

export type MigrationValidationResult = {
  name: string;
  status: "valid" | "checksumMismatch" | "missingInState" | "missingLocally";
};

export interface MigrationAction<TSchema, TBuilt> {
  create: TSchema[];
  delete: TBuilt[];
  update: {
    current: TBuilt;
    planned: TBuilt;
    method: "update" | "replace";
  }[];
}

export type MigrationPlan2 = {
  indexes: MigrationAction<AnyIndex, SearchIndex>;
  indexers: MigrationAction<AnyIndexer, SearchIndexer>;
  dataSources: MigrationAction<
    AnyDataSourceConnection,
    SearchIndexerDataSourceConnection
  >;
};

export type MigrationPlan = Array<
  | {
      resourceType: ResourceTypes.Index;
      action: "create";
      resource: SearchIndex;
    }
  | {
      resourceType: ResourceTypes.Index;
      action: "delete";
      resource: IndexResource;
    }
  | {
      resourceType: ResourceTypes.Indexer;
      action: "create";
      resource: SearchIndexer;
    }
  | {
      resourceType: ResourceTypes.Indexer;
      action: "delete";
      resource: IndexerResource;
    }
  | {
      resourceType: ResourceTypes.Indexer;
      action: "update";
      resource: SearchIndexer;
    }
  | {
      resourceType: ResourceTypes.DataSource;
      action: "create";
      resource: SearchIndexerDataSourceConnection;
    }
  | {
      resourceType: ResourceTypes.DataSource;
      action: "delete";
      resource: DataSourceResource;
    }
  | {
      resourceType: ResourceTypes.DataSource;
      action: "update";
      resource: SearchIndexerDataSourceConnection;
    }
>;
