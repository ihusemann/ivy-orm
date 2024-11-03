import chalk from "chalk";
import _ from "lodash";
import {
  DataSourceResource,
  IndexerResource,
  IndexResource,
  MigrationFile,
  ResourceType,
} from "./types";
import { AnyDataSourceConnection, AnyIndex, AnyIndexer } from "ivy-orm";
import {
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
} from "@azure/search-documents";

export interface ResourceHandlers<TSchema, TResource, TBuilt> {
  /**
   * type guard function
   */
  isResource: (resource: any) => resource is TResource;

  buildFn: (schemaResource: TSchema) => TBuilt;

  /**
   * function that returns the name of the resource stored in ivy-kit state
   */
  getName: (resource: TSchema | TResource) => string;

  /**
   * function that returns the checksum of the resource stored in ivy-kit state
   */
  getChecksum: (resource: TResource) => string;

  generateChecksum: (built: TBuilt) => string;

  resourceType: ResourceType;
}

interface MigrationAction<TSchema, TState, TBuilt> {
  create: TSchema[];
  delete: TState[];
  update: [TBuilt, TState][];
}

export function computeMigrationActions<TSchema, TState, TBuilt>(
  schemaResources: TSchema[],
  stateResources: TState[],
  handlers: ResourceHandlers<TSchema, TState, TBuilt>
): MigrationAction<TSchema, TState, TBuilt> {
  const { buildFn, getName, getChecksum } = handlers;

  const create = _.differenceBy(schemaResources, stateResources, getName);
  const toDelete = _.differenceBy(stateResources, schemaResources, getName);

  const modified = _.intersectionBy(schemaResources, stateResources, getName)
    // filter to resources whose checksum doesn't match that stored in state
    .filter((schemaResource) => {
      const name = getName(schemaResource);
      const builtResource = buildFn(schemaResource);
      const checksum = handlers.generateChecksum(builtResource);

      const stateResource = stateResources.find((sr) => getName(sr) === name);

      if (!stateResource) {
        throw new Error(
          `${chalk.red.bold("Error:")} State resource not found for ${name}.`
        );
      }

      const savedChecksum = getChecksum(stateResource);

      if (!savedChecksum) {
        throw new Error(
          `${chalk.red.bold("Error:")} Missing checksum for resource ${name}.`
        );
      }

      return checksum !== savedChecksum;
    })
    // "link" the schema resource to the associated out-of-date resource in the state
    .map((schemaResource) => {
      const stateResource = stateResources.find(
        (sr) => getName(sr) === getName(schemaResource)
      );
      return [buildFn(schemaResource), stateResource] as [TBuilt, TState];
    });

  return {
    create,
    delete: toDelete,
    update: modified,
  };
}

function removeId(resource: any) {
  const { id: _, ...rest } = resource;
  return rest;
}

export function generateMigrationFile({
  indexActions,
  indexerActions,
  dataSourceActions,
}: {
  indexActions: MigrationAction<AnyIndex, IndexResource, SearchIndex>;
  indexerActions: MigrationAction<AnyIndexer, IndexerResource, SearchIndexer>;
  dataSourceActions: MigrationAction<
    AnyDataSourceConnection,
    DataSourceResource,
    SearchIndexerDataSourceConnection
  >;
}): MigrationFile {
  return {
    indexes: {
      create: [
        ...indexActions.create.map((idx) => idx["build"]()),
        ...indexActions.update.map(([built]) => built),
      ],
      delete: [
        ...indexActions.delete.map(removeId),
        ...indexActions.update.map(([, state]) => state).map(removeId),
      ],
    },
    indexers: {
      create: [
        ...indexerActions.create.map((idxr) => idxr["build"]()),
        ...indexerActions.update.map(([built]) => built),
      ],
      delete: [
        ...indexerActions.delete.map(removeId),
        ...indexerActions.update.map(([, state]) => state).map(removeId),
      ],
    },
    dataSources: {
      create: [
        ...dataSourceActions.create.map((src) => src["build"]()),
        ...dataSourceActions.update.map(([built]) => built),
      ],
      delete: [
        ...dataSourceActions.delete.map(removeId),
        ...dataSourceActions.update.map(([, state]) => state).map(removeId),
      ],
    },
  };
}
