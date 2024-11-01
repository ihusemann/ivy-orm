import { isSearchIndex, isSearchIndexer } from "@ivy-orm/core";
import { isDataSource } from "ivy-orm";
import { z } from "zod";

export const migrationSchema = z.object({
  id: z.string(),
  migrationName: z.string(),
  checksum: z.string(),
  startedAt: z.date(),
  finishedAt: z.date().nullish(),
  logs: z.string().nullish(),
});

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  checksum: z.string(),
});

export const indexResourceSchema = resourceSchema.extend({
  type: z.literal("index"),
});

export const indexerResourceSchema = resourceSchema.extend({
  type: z.literal("indexer"),
});

export const dataSourceResourceSchema = resourceSchema.extend({
  type: z.literal("dataSource"),
});

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
