import {
  AzureKeyCredential,
  SearchClientOptions,
  SearchIndexClient,
  SearchIndexerClient,
} from "@azure/search-documents";
import type { TokenCredential } from "@azure/identity";
import { AnyIndex } from "./schema/search-index";
import { AnyIndexer } from "./schema/search-indexer";

export class Migrator {
  private searchIndexClient: SearchIndexClient;
  private searchIndexerClient: SearchIndexerClient;

  constructor(
    endpoint: string,
    credential: AzureKeyCredential | TokenCredential,
    options?: SearchClientOptions
  ) {
    this.searchIndexClient = new SearchIndexClient(
      endpoint,
      credential,
      options
    );
    this.searchIndexerClient = new SearchIndexerClient(
      endpoint,
      credential,
      options
    );
  }

  private async createIndexes(indexes: Record<string, AnyIndex>) {
    for await (const idx of Object.values(indexes)) {
      const index = idx["build"]();
      console.log("Deleting index", index.name);

      await this.searchIndexClient.deleteIndex(index.name);

      console.log("Creating:", index);

      await this.searchIndexClient.createIndex(index);
    }
  }

  private async createIndexers(indexers: Record<string, AnyIndexer>) {
    for await (const idxr of Object.values(indexers)) {
      const indexer = idxr["build"]();
      console.log("Deleting index", indexer.name);

      await this.searchIndexerClient.deleteIndexer(indexer.name);

      await this.searchIndexerClient.createIndexer(indexer);
    }
  }

  async create({
    indexes,
    indexers,
  }: {
    indexes: Record<string, AnyIndex>;
    indexers: Record<string, AnyIndexer>;
  }) {
    await this.createIndexes(indexes);
    await this.createIndexers(indexers);
    console.log("Done");
  }
}
