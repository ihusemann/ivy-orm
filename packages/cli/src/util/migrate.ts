import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";
import chalk from "chalk";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { z } from "zod";

const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  etag: z.string().nullish(),
  type: z.string(),
  checksum: z.string(),
});

const indexResourceSchema = resourceSchema.extend({
  type: z.literal("index"),
});

export type IndexResource = z.infer<typeof indexResourceSchema>;

export function isIndexResource(resource: any): resource is IndexResource {
  try {
    indexResourceSchema.parse(resource);
    return true;
  } catch {
    return false;
  }
}

const indexerResourceSchema = resourceSchema.extend({
  type: z.literal("indexer"),
});

export type IndexerResource = z.infer<typeof indexerResourceSchema>;

export function isIndexerResource(resource: any): resource is IndexerResource {
  try {
    indexerResourceSchema.parse(resource);
    return true;
  } catch {
    return false;
  }
}

const dataSourceResourceSchema = resourceSchema.extend({
  type: z.literal("dataSource"),
});

export type DataSourceResource = z.infer<typeof dataSourceResourceSchema>;

export function isDataSourceResource(
  resource: any
): resource is DataSourceResource {
  try {
    dataSourceResourceSchema.parse(resource);
    return true;
  } catch {
    return false;
  }
}

export type Resource = z.infer<typeof resourceSchema>;

const migrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  appliedAt: z.date(),
});

export type Migration = z.infer<typeof migrationSchema>;

export interface Adapter {
  listResources(): Promise<Resource[]>;
  updateResource(id: string, data: Partial<Resource>): Promise<void>;
  createResource(data: Omit<Resource, "id">): Promise<Resource>;
  deleteResource(id: string): Promise<void>;

  listAppliedMigrations(): Promise<Migration[]>;
  applyMigration(name: string): Promise<Migration>;
}

export function ensureMigrationsDirectory(
  cwd: string,
  schema: string,
  out: string
) {
  const migrationDirectoryPath = path.join(
    path.dirname(path.join(cwd, schema)),
    out
  );
  try {
    if (!existsSync(migrationDirectoryPath)) {
      mkdirSync(migrationDirectoryPath);
    }

    return migrationDirectoryPath;
  } catch {
    8;
    throw new Error(
      `${chalk.red.bold("Error:")} failed to create migration directory at ${chalk.yellow(migrationDirectoryPath)}`
    );
  }
}

function isSearchIndex(index: any): index is SearchIndex {
  return index.name && index.fields;
}

function isSearchIndexer(indexer: any): indexer is SearchIndexer {
  return indexer.name && indexer.dataSourceName;
}

function isDataSource(
  dataSource: any
): dataSource is SearchIndexerDataSourceConnection {
  return dataSource.name && dataSource.container.name;
}

function isResource(resource: any): resource is Resource {
  return resource.name && resource.etag;
}

export const migrationFileSchema = z.object({
  indexes: z.object({
    create: z.any().refine(isSearchIndex).array(),
    delete: indexResourceSchema.array(),
  }),
  indexers: z.object({
    create: z.any().refine(isSearchIndexer).array(),
    delete: indexerResourceSchema.array(),
  }),
  dataSources: z.object({
    create: z.any().refine(isDataSource).array(),
    delete: dataSourceResourceSchema.array(),
  }),
});

export type MigrationFile = z.infer<typeof migrationFileSchema>;

function normalizeETag(eTag: string) {
  // Remove escaped quotes if present
  return eTag.replace(/^\"|\"$/g, "");
}

export const ensureETagsMatch = (a?: string, b?: string) => {
  console.log(a, b);
  if (!a || !b) return false;

  return normalizeETag(a) === normalizeETag(b);
};
