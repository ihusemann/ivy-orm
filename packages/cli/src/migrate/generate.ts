import chalk from "chalk";
import _ from "lodash";
import {
  DataSourceResource,
  IndexerResource,
  IndexResource,
  MigrationAction,
  MigrationFile,
  ResourceType,
} from "./types";
import { AnyDataSourceConnection, AnyIndex, AnyIndexer } from "ivy-orm";
import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";
import {
  isDataSourceResource,
  isIndexerResource,
  isIndexResource,
} from "./guards";
import {
  generateIndexChecksum,
  generateIndexerChecksum,
  generateDataSourceChecksum,
} from "./checksum";
import { isSimpleField } from "@ivy-orm/core";

export interface ResourceHandlers<TSchema, TBuilt> {
  buildFn: (schemaResource: TSchema) => TBuilt;

  /**
   * function that returns the name of the resource
   */
  getName: (resource: TSchema | TBuilt) => string;

  generateChecksum: (built: TSchema | TBuilt) => string;

  resourceType: ResourceType;
}

export function computeMigrationActions<TSchema, TBuilt>(
  schemaResources: TSchema[],
  deployedResources: TBuilt[],
  handlers: ResourceHandlers<TSchema, TBuilt>
): MigrationAction<TSchema, TBuilt> {
  const { buildFn, getName, generateChecksum } = handlers;

  const create = _.differenceBy(schemaResources, deployedResources, getName);
  const toDelete = _.differenceBy(deployedResources, schemaResources, getName);

  const modified = _.intersectionBy(schemaResources, deployedResources, getName)
    // filter to resources whose checksum doesn't match that stored in state
    .filter((schemaResource) => {
      const name = getName(schemaResource);
      const builtResource = buildFn(schemaResource);
      const checksum = handlers.generateChecksum(builtResource);

      const stateResource = deployedResources.find(
        (sr) => getName(sr) === name
      );

      if (!stateResource) {
        throw new Error(
          `${chalk.red.bold("Error:")} State resource not found for ${name}.`
        );
      }

      const savedChecksum = handlers.generateChecksum(stateResource);

      return checksum !== savedChecksum;
    })
    // "link" the schema resource to the associated out-of-date resource in the state
    .map((schemaResource) => {
      const stateResource = deployedResources.find(
        (sr) => getName(sr) === getName(schemaResource)
      );
      return [buildFn(schemaResource), stateResource] as [TBuilt, TBuilt];
    });

  return {
    create,
    delete: toDelete,
    update: modified.map(([planned, current]) => ({
      current,
      planned,
      method: "replace",
    })),
  };
}

export const indexHandlers: ResourceHandlers<AnyIndex, SearchIndex> = {
  buildFn: (index) => index["build"](),
  getName: (resource) => resource.name,
  generateChecksum: (index) => generateIndexChecksum(index),
  resourceType: "index",
};

export const indexerHandlers: ResourceHandlers<AnyIndexer, SearchIndexer> = {
  buildFn: (indexer) => indexer["build"](),
  getName: (resource) => resource.name,
  generateChecksum: (indexer) => generateIndexerChecksum(indexer),
  resourceType: "indexer",
};

export const dataSourceHandlers: ResourceHandlers<
  AnyDataSourceConnection,
  SearchIndexerDataSourceConnection
> = {
  buildFn: (dataSource) => dataSource["build"](),
  getName: (resource) => resource.name,
  generateChecksum: (dataSource) => generateDataSourceChecksum(dataSource),
  resourceType: "dataSource",
};

function removeId(resource: any) {
  const { id: _, ...rest } = resource;
  return rest;
}

export function generateMigrationFile({
  indexActions,
  indexerActions,
  dataSourceActions,
}: {
  indexActions: MigrationAction<AnyIndex, SearchIndex>;
  indexerActions: MigrationAction<AnyIndexer, SearchIndexer>;
  dataSourceActions: MigrationAction<
    AnyDataSourceConnection,
    SearchIndexerDataSourceConnection
  >;
}): MigrationFile {
  return {
    indexes: {
      create: [
        ...indexActions.create.map((idx) => idx["build"]()),
        ...indexActions.update
          .filter(({ method }) => method === ("replace" as const))
          .map(({ planned }) => planned),
      ],
      delete: [
        ...indexActions.delete.map(removeId),
        ...indexActions.update
          .filter(({ method }) => method === ("replace" as const))
          .map(({ current }) => removeId(current)),
      ],
    },
    indexers: {
      create: [
        ...indexerActions.create.map((idxr) => idxr["build"]()),
        ...indexerActions.update
          .filter(({ method }) => method === ("replace" as const))
          .map(({ planned }) => planned),
      ],
      delete: [
        ...indexerActions.delete.map(removeId),
        ...indexerActions.update
          .filter(({ method }) => method === ("replace" as const))
          .map(({ current }) => removeId(current)),
      ],
    },
    dataSources: {
      create: [
        ...dataSourceActions.create.map((src) => src["build"]()),
        ...dataSourceActions.update
          .filter(({ method }) => method === ("replace" as const))
          .map(({ planned }) => planned),
      ],
      delete: [
        ...dataSourceActions.delete.map(removeId),
        ...dataSourceActions.update
          .filter(({ method }) => method === ("replace" as const))
          .map(({ current }) => removeId(current)),
      ],
    },
  };
}
