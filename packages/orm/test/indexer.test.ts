import { describe, it, expect } from "vitest";
import { dataSource, index, indexer, int32, string } from "../src";
import { FieldMapping, SearchIndexer } from "@azure/search-documents";

const defaultIndexerProperties: Partial<SearchIndexer> = {
  description: undefined,
  encryptionKey: undefined,
  etag: undefined,
  fieldMappings: [],
  isDisabled: undefined,
  outputFieldMappings: undefined,
  parameters: undefined,
  schedule: undefined,
  skillsetName: undefined,
};

const basicIndex = index("basicIndex", {
  name: string("name").key(),
});

describe("Indexer", () => {
  it("should correctly generate a SearchIndexer", () => {
    const myIndexer = indexer("myIndexer", {
      dataSourceName: "dataSourceName",
      targetIndex: basicIndex,
    });

    expect(myIndexer["build"]()).toEqual({
      ...defaultIndexerProperties,
      name: "myIndexer",
      dataSourceName: "dataSourceName",
      targetIndexName: "basicIndex",
    });
  });

  it("should correctly generate implicit field mappings", () => {
    const myIndexer = indexer("myIndexer", {
      dataSourceName: "dataSourceName",
      targetIndex: index("index", {
        beds: int32("bedCount"),
      }),
    });

    expect(myIndexer.fieldMappings).toEqual([
      {
        sourceFieldName: "bedCount",
        targetFieldName: "beds",
      },
    ]);
  });

  it("should correctly merge implicit and explicit field mappings", () => {
    const myIndexer = indexer("myIndexer", {
      dataSourceName: "dataSourceName",
      targetIndex: index("index", {
        name: string("name").key(),
        beds: int32("bedCount"),
      }),
      fieldMappings: [
        {
          sourceFieldName: "name",
          targetFieldName: "name",
          mappingFunction: {
            name: "base64Encode",
          },
        },
      ],
    });

    expect(myIndexer.fieldMappings).toEqual([
      {
        sourceFieldName: "name",
        targetFieldName: "name",
        mappingFunction: {
          name: "base64Encode",
        },
      },
      {
        sourceFieldName: "bedCount",
        targetFieldName: "beds",
      },
    ]);
  });

  it("should correctly prioritize explicit fieldMapping over implicit", () => {
    const myIndexer = indexer("myIndexer", {
      dataSourceName: "dataSourceName",
      targetIndex: index("index", {
        name: string("streetName").key(),
      }),
      fieldMappings: [
        {
          sourceFieldName: "streetName",
          targetFieldName: "name",
          mappingFunction: {
            name: "base64Encode",
          },
        },
      ],
    });

    expect(myIndexer.fieldMappings).toEqual([
      {
        sourceFieldName: "streetName",
        targetFieldName: "name",
        mappingFunction: {
          name: "base64Encode",
        },
      },
    ]);
  });
});
