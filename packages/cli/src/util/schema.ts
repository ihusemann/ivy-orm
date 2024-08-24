import { AnyIndex, AnyIndexer, isIndex, isIndexer } from "ivy-orm";
import fs from "fs";
import chalk from "chalk";

export type Schema = {
  indexes: Record<string, AnyIndex>;
  indexers: Record<string, AnyIndexer>;
};

export function readSchema(file: string): Schema {
  if (!fs.existsSync(file)) {
    throw new Error(`Error: Could not find schema file at '${file}'`);
  }

  const indexes: [string, AnyIndex][] = [];
  const indexers: [string, AnyIndexer][] = [];

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
  });

  if (indexes.length === 0 && indexers.length === 0) {
    throw new Error(
      `${chalk.bold.red("Error:")} at least one valid index or indexer must be defined.`
    );
  }

  const schema = {
    indexes: Object.fromEntries(indexes),
    indexers: Object.fromEntries(indexers),
  };

  return schema;
}
