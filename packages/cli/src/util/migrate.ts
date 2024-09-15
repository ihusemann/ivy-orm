import { SearchIndex, SearchIndexer } from "@azure/search-documents";
import chalk from "chalk";
import { applyChange } from "deep-diff";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { z } from "zod";

// export interface Resource {
//   id: string;
//   name: string;
//   etag: string;
//   type: string;
// }

// const resourceTypeSchema = z.enum(["index", "indexer", "datasource"]);

// export type ResourceType = z.infer<typeof resourceTypeSchema>;

const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  etag: z.string(),
  type: z.string(),
});

const indexResourceSchema = resourceSchema.extend({
  type: z.literal("index"),
});

type IndexResource = z.infer<typeof indexResourceSchema>;

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

type IndexerResource = z.infer<typeof indexerResourceSchema>;

export function isIndexerResource(resource: any): resource is IndexerResource {
  try {
    indexerResourceSchema.parse(resource);
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

// export interface Migration {
//   id: string;
//   name: string;
//   appliedAt: Date;
// }

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
