import { ZodSchema } from "zod";
import {
  dataSourceResourceSchema,
  indexerResourceSchema,
  indexResourceSchema,
  resourceSchema,
} from "./schemas";
import {
  DataSourceResource,
  IndexerResource,
  IndexResource,
  Resource,
} from "./types";

class ResourceGuard<T> {
  schema: ZodSchema;

  constructor(schema: ZodSchema) {
    this.schema = schema;
  }

  guard(v: any): v is T {
    try {
      this.schema.parse(v);
      return true;
    } catch {
      return false;
    }
  }
}

const resourceGuard = new ResourceGuard<Resource>(resourceSchema);

/**
 * Determines whether a resource is a valid Resource.
 *
 * @param resource - The resource to evaluate.
 * @returns A boolean indicating whether the provided type is a Resource.
 */
export function isResource(resource: any): resource is Resource {
  return (
    resourceGuard.guard(resource) &&
    ["index", "indexer", "dataSource"].includes(resource.type)
  );
}

const indexGaurd = new ResourceGuard<IndexResource>(indexResourceSchema);

/**
 * Determines whether a resource is an IndexResource.
 *
 * @param resource - The resource to evaluate.
 * @returns A boolean indicating whether the provided type is an IndexResource.
 */
export function isIndexResource(resource: any): resource is IndexResource {
  return indexGaurd.guard(resource);
}

const indexerGuard = new ResourceGuard<IndexerResource>(indexerResourceSchema);

/**
 * Determines whether a resource is an IndexerResource.
 *
 * @param resource - The resource to evaluate.
 * @returns A boolean indicating whether the provided type is an IndexResource.
 */
export function isIndexerResource(resource: any): resource is IndexerResource {
  return indexerGuard.guard(resource);
}

const dataSourceGuard = new ResourceGuard<DataSourceResource>(
  dataSourceResourceSchema
);

/**
 * Determines whether a resource is an IndexerResource.
 *
 * @param resource - The resource to evaluate.
 * @returns A boolean indicating whether the provided type is an IndexResource.
 */
export function isDataSourceResource(
  resource: any
): resource is DataSourceResource {
  return dataSourceGuard.guard(resource);
}
