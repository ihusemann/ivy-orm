import { describe, it, expect } from "vitest";
import { dataSource } from "../src";
import { SearchIndexerDataSourceConnection } from "@azure/search-documents";

const defaultDataSourceProperties: Partial<SearchIndexerDataSourceConnection> =
  {
    dataChangeDetectionPolicy: undefined,
    dataDeletionDetectionPolicy: undefined,
    description: undefined,
    encryptionKey: undefined,
    etag: undefined,
  };

describe("Data Source", () => {
  it("should correctly generate a SearchIndexerDataSourceConnection", () => {
    const myDataSource = dataSource("dataSource", "azuresql", {
      container: {
        name: "dbo.table",
      },
      connectionString: "MyConnectionString",
    });

    const expected: SearchIndexerDataSourceConnection = {
      ...defaultDataSourceProperties,
      name: "dataSource",
      type: "azuresql",
      container: {
        name: "dbo.table",
      },
      connectionString: "MyConnectionString",
    };

    expect(myDataSource["build"]()).toEqual(expected);
  });
});
