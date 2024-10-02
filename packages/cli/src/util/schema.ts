import {
  AnyDataSourceConnection,
  AnyIndex,
  AnyIndexer,
  isDataSource,
  isIndex,
  isIndexer,
} from "ivy-orm";
import fs from "fs";

export type Schema = {
  indexes: Record<string, AnyIndex>;
  indexers: Record<string, AnyIndexer>;
  dataSources: Record<string, AnyDataSourceConnection>;
};

export function readSchema(file: string): Schema {
  if (!fs.existsSync(file)) {
    throw new Error(`Error: Could not find schema file at '${file}'`);
  }

  const indexes: [string, AnyIndex][] = [];
  const indexers: [string, AnyIndexer][] = [];
  const dataSources: [string, AnyDataSourceConnection][] = [];

  const schemaExports = require(file);

  Object.entries(schemaExports).forEach(([name, i]) => {
    if (isIndexer(i)) {
      indexers.push([name, i]);
      return;
    }

    if (isIndex(i)) {
      indexes.push([name, i]);
      return;
    }

    if (isDataSource(i)) {
      dataSources.push([name, i]);
      return;
    }
  });

  const schema = {
    indexes: Object.fromEntries(indexes),
    indexers: Object.fromEntries(indexers),
    dataSources: Object.fromEntries(dataSources),
  };

  return schema;
}
