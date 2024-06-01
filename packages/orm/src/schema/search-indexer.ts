import { SearchIndexer } from "@azure/search-documents";
import { Index } from "./search-index";
import { generateFieldMappings } from "./util";

class Indexer<
  TIndexerName extends string,
  TIndexerConfig extends Omit<
    SearchIndexer,
    "name" | "targetIndexName" | "fieldMappings"
  > & {
    targetIndex: Index<string, any>;
  }
> {
  private searchIndexer: SearchIndexer;

  constructor(name: TIndexerName, config: TIndexerConfig) {
    const { targetIndex, ...rest } = config;
    const fieldMappings = generateFieldMappings(targetIndex.fields);

    this.searchIndexer = {
      name,
      targetIndexName: targetIndex.name,
      fieldMappings,
      ...rest,
    };
  }

  /* @internal */
  private build(): SearchIndexer {
    return this.searchIndexer;
  }

  // public getIndexer(): SearchIndexer {
  //   return this.build();
  // }
}

export type AnyIndexer<TIndexerName extends string = string> = Indexer<
  TIndexerName,
  Omit<SearchIndexer, "name" | "targetIndexName" | "fieldMappings"> & {
    targetIndex: Index<string, any>;
  }
>;

export function indexer<
  TIndexerName extends string,
  TIndexerConfig extends Omit<
    SearchIndexer,
    "name" | "targetIndexName" | "fieldMappings"
  > & {
    targetIndex: Index<string, any>;
  }
>(name: TIndexerName, config: TIndexerConfig) {
  return new Indexer(name, config);
}
