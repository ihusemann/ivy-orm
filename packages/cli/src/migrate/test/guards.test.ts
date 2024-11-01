import { describe, it, expect, expectTypeOf } from "vitest";
import { DataSourceResource, IndexerResource, IndexResource } from "../types";
import {
  isDataSourceResource,
  isIndexerResource,
  isIndexResource,
} from "../guards";

describe("Migration Guards", () => {
  describe("Index Guard", () => {
    it("should return true for a valid index resource", () => {
      const index = {
        id: "id",
        checksum: "checksum",
        name: "name",
        type: "index",
      };

      expect(isIndexResource(index)).toBe(true);

      if (isIndexResource(index)) {
        expectTypeOf<IndexResource>(index);
      }
    });

    it("should return false for an invalid index resource", () => {
      const index: Partial<IndexResource> = {
        id: "id",
        name: "name",
        type: "index",
      };

      expect(isIndexResource(index)).toBe(false);
    });
  });

  describe("Indexer Guard", () => {
    it("should return true for a valid indexer resource", () => {
      const indexer = {
        id: "id",
        checksum: "checksum",
        name: "name",
        type: "indexer",
      };

      expect(isIndexerResource(indexer)).toBe(true);

      if (isIndexerResource(indexer)) expectTypeOf<IndexerResource>(indexer);
    });

    it("should return false for an invalid indexer resource", () => {
      const index: Partial<IndexerResource> = {
        id: "id",
        name: "name",
        type: "indexer",
      };

      expect(isIndexerResource(index)).toBe(false);
    });
  });

  describe("Data Source Guard", () => {
    it("should return true for a valid data source resource", () => {
      const dataSource = {
        id: "id",
        checksum: "checksum",
        name: "name",
        type: "dataSource",
      };

      expect(isDataSourceResource(dataSource)).toBe(true);

      if (isDataSourceResource(dataSource))
        expectTypeOf<DataSourceResource>(dataSource);
    });

    it("should return false for an invalid data source resource", () => {
      const dataSource: Partial<DataSourceResource> = {
        id: "id",
        name: "name",
        type: "dataSource",
      };

      expect(isDataSourceResource(dataSource)).toBe(false);
    });
  });
});
