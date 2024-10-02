import { describe, expect, it } from "vitest";
import {
  generateDataSourceChecksum,
  generateFieldChecksum,
  generateIndexChecksum,
  generateIndexerChecksum,
} from "../src/util/checksum";
import {
  ComplexField,
  SearchIndex,
  SearchIndexer,
  SearchIndexerDataSourceConnection,
  SimpleField,
} from "@azure/search-documents";

describe("indexer checksums", () => {
  it("should generate a string checksum", () => {
    const indexer: SearchIndexer = {
      name: "my-indexer",
      dataSourceName: "my-datasource",
      targetIndexName: "my-index",
    };

    const actual = generateIndexerChecksum(indexer);

    const expected = "a70a7e4a59d6aef65af94b19b5e0ef219f32bf88";
    expect(actual).toBe(expected);
  });

  it("should ignore etag value", () => {
    const indexer: SearchIndexer = {
      name: "my-indexer",
      dataSourceName: "my-datasource",
      targetIndexName: "my-index",
      etag: "my-etag",
    };

    const actual = generateIndexerChecksum(indexer);

    const expected = "a70a7e4a59d6aef65af94b19b5e0ef219f32bf88";
    expect(actual).toBe(expected);
  });

  it("should deterministically generate checksums, indifferent to object order", () => {
    const indexerA: SearchIndexer = {
      name: "my-indexer",
      dataSourceName: "my-datasource",
      targetIndexName: "my-index",
    };

    const indexerB: SearchIndexer = {
      name: "my-indexer",
      targetIndexName: "my-index",
      dataSourceName: "my-datasource",
    };

    expect(generateIndexerChecksum(indexerA)).toBe(
      generateIndexerChecksum(indexerB)
    );
  });

  it("should recognize differences in value", () => {
    const indexerA: SearchIndexer = {
      name: "my-indexer",
      dataSourceName: "my-datasource",
      targetIndexName: "my-index",
    };

    const indexerB: SearchIndexer = {
      name: "my-indexer2",
      targetIndexName: "my-index",
      dataSourceName: "my-datasource",
    };

    expect(generateIndexerChecksum(indexerA)).not.toBe(
      generateIndexerChecksum(indexerB)
    );
  });

  it("should treat undefined the same as a property not existing", () => {
    const indexer: SearchIndexer = {
      name: "delete-me-realestate-idxr-04",
      dataSourceName: "realestate-us-sample",
      description: undefined,
      encryptionKey: undefined,
      etag: undefined,
      fieldMappings: [
        {
          sourceFieldName: "listingId",
          targetFieldName: "id",
          mappingFunction: { name: "base64Encode" },
        },
      ],
      isDisabled: undefined,
      outputFieldMappings: undefined,
      parameters: undefined,
      schedule: undefined,
      skillsetName: undefined,
      targetIndexName: "delete-me-realestate-us-sample-index-04",
    };

    const actual = generateIndexerChecksum(indexer);
    const expected = "5465102b02528cc632ce5e1c2d83736f0ecb748e";

    expect(actual).toBe(expected);
  });

  it("should handle indexers with field mappings", () => {
    const indexer: SearchIndexer = {
      name: "delete-me-realestate-idxr-04",
      dataSourceName: "realestate-us-sample",
      fieldMappings: [
        {
          sourceFieldName: "listingId",
          targetFieldName: "id",
          mappingFunction: {
            name: "base64Encode",
          },
        },
      ],
      targetIndexName: "delete-me-realestate-us-sample-index-04",
    };

    const actual = generateIndexerChecksum(indexer);
    const expected = "5465102b02528cc632ce5e1c2d83736f0ecb748e";

    expect(actual).toBe(expected);
  });
});

describe("field checksums", () => {
  it("should generate a string checksum for SimpleField", () => {
    const field: SimpleField = {
      name: "my-field",
      type: "Edm.String",
      key: true,
    };

    const expected = "8b9889b2d6937b198adc9f40607585d9bd57690a";

    const actual = generateFieldChecksum(field);

    expect(actual).toBe(expected);
  });

  it("should ignore undefined values", () => {
    const field: SimpleField = {
      name: "my-field",
      type: "Edm.String",
      filterable: undefined,
      key: true,
    };

    const expected = "8b9889b2d6937b198adc9f40607585d9bd57690a";

    const actual = generateFieldChecksum(field);

    expect(actual).toBe(expected);
  });

  it("should deterministically generate checksums, indifferent to object order", () => {
    const fieldA: SimpleField = {
      name: "my-field",
      type: "Edm.String",
      key: true,
    };

    const fieldB: SimpleField = {
      name: "my-field",
      key: true,
      type: "Edm.String",
    };

    expect(generateFieldChecksum(fieldA)).toBe(generateFieldChecksum(fieldB));
  });

  it("should recognize differences in value", () => {
    const fieldA: SimpleField = {
      name: "my-field",
      type: "Edm.String",
      key: true,
    };

    const fieldB: SimpleField = {
      name: "my-field",
      type: "Edm.String",
      key: false,
    };

    expect(generateFieldChecksum(fieldA)).not.toBe(
      generateFieldChecksum(fieldB)
    );
  });

  it("should generate a checksum for a ComplexField", () => {
    const field: ComplexField = {
      name: "my-field",
      type: "Edm.ComplexType",
      fields: [
        {
          name: "my-sub-field",
          type: "Edm.Int64",
          filterable: true,
        },
      ],
    };

    const actual = generateFieldChecksum(field);
    const expected = "80fae7b4a16d2abc6a85f30534ac6b7ecbf9e9cc";

    expect(actual).toBe(expected);
  });

  it("should recognize differences in complex field values", () => {
    const field: ComplexField = {
      name: "my-field",
      type: "Edm.ComplexType",
      fields: [
        {
          name: "my-sub-field2",
          type: "Edm.Int64",
          filterable: true,
        },
      ],
    };

    const actual = generateFieldChecksum(field);
    const expected = "80fae7b4a16d2abc6a85f30534ac6b7ecbf9e9cc";

    expect(actual).not.toBe(expected);
  });

  it("should deterministically generate checksums, indifferent to object order", () => {
    const field: ComplexField = {
      type: "Edm.ComplexType",
      name: "my-field",
      fields: [
        {
          name: "my-sub-field",
          filterable: true,
          type: "Edm.Int64",
        },
      ],
    };

    const actual = generateFieldChecksum(field);
    const expected = "80fae7b4a16d2abc6a85f30534ac6b7ecbf9e9cc";

    expect(actual).toBe(expected);
  });

  it("should generate checksum for ComplexField with multiple fields", () => {
    const field: ComplexField = {
      type: "Edm.ComplexType",
      name: "my-field",
      fields: [
        {
          name: "my-sub-field",
          type: "Edm.Int64",
          filterable: true,
        },
        {
          name: "my-sub-field-2",
          type: "Edm.String",
          filterable: true,
          facetable: true,
        },
      ],
    };

    const actual = generateFieldChecksum(field);
    const expected = "08425ba999e686cb804c3e6a69a5a73aeab993d7";

    expect(actual).toBe(expected);
  });

  it("should deterministically generate checksums, indifferent to array order", () => {
    const field: ComplexField = {
      type: "Edm.ComplexType",
      name: "my-field",
      fields: [
        {
          name: "my-sub-field-2",
          type: "Edm.String",
          filterable: true,
          facetable: true,
        },
        {
          name: "my-sub-field",
          type: "Edm.Int64",
          filterable: true,
        },
      ],
    };

    const actual = generateFieldChecksum(field);
    const expected = "08425ba999e686cb804c3e6a69a5a73aeab993d7";

    expect(actual).toBe(expected);
  });

  it("should deterministically generate checksums, indifferent to array and object order", () => {
    const field: ComplexField = {
      name: "my-field",
      type: "Edm.ComplexType",
      fields: [
        {
          name: "my-sub-field-2",
          filterable: true,
          facetable: true,
          type: "Edm.String",
        },
        {
          type: "Edm.Int64",
          name: "my-sub-field",
          filterable: true,
        },
      ],
    };

    const actual = generateFieldChecksum(field);
    const expected = "08425ba999e686cb804c3e6a69a5a73aeab993d7";

    expect(actual).toBe(expected);
  });
});

describe("index checksums", () => {
  it("should generate a checksum", () => {
    const index: SearchIndex = {
      name: "my-index",
      fields: [],
    };

    const actual = generateIndexChecksum(index);
    const expected = "8333651e73331d436c5a617932e11969a4b09873";

    expect(actual).toBe(expected);
  });

  it("should ignore unmanaged fields", () => {
    const index: SearchIndex = {
      name: "my-index",
      fields: [],
      etag: "my-etag",
      tokenizers: [
        {
          name: "my-tokenizer",
          odatatype: "#Microsoft.Azure.Search.PatternTokenizer",
        },
      ],
    };

    const actual = generateIndexChecksum(index);
    const expected = "8333651e73331d436c5a617932e11969a4b09873";

    expect(actual).toBe(expected);
  });

  it("should recognize changes to values", () => {
    const index: SearchIndex = {
      name: "my-index2",
      fields: [],
    };

    const actual = generateIndexChecksum(index);
    const expected = "8333651e73331d436c5a617932e11969a4b09873";

    expect(actual).not.toBe(expected);
  });

  it("should deterministically generate a checksum, indifferent to object order", () => {
    const index: SearchIndex = {
      fields: [],
      name: "my-index",
    };

    const actual = generateIndexChecksum(index);
    const expected = "8333651e73331d436c5a617932e11969a4b09873";

    expect(actual).toBe(expected);
  });

  it("should generate a checksum with fields", () => {
    const index: SearchIndex = {
      name: "my-index",
      fields: [
        {
          name: "my-sub-field",
          filterable: true,
          type: "Edm.Int64",
        },
      ],
    };

    const actual = generateIndexChecksum(index);
    const expected = "25040b400c633dc492d9f0539daa09b3ea8dd470";

    expect(actual).toBe(expected);
  });

  it("should recognize changes to field values", () => {
    const index: SearchIndex = {
      name: "my-index",
      fields: [
        {
          name: "my-sub-field2",
          filterable: true,
          type: "Edm.Int64",
        },
      ],
    };

    const actual = generateIndexChecksum(index);
    const expected = "25040b400c633dc492d9f0539daa09b3ea8dd470";

    expect(actual).not.toBe(expected);
  });

  it("should deterministically generate a checksum with fields, indifferent to object order", () => {
    const index: SearchIndex = {
      fields: [
        {
          type: "Edm.Int64",
          name: "my-sub-field",
          filterable: true,
        },
      ],
      name: "my-index",
    };

    const actual = generateIndexChecksum(index);
    const expected = "25040b400c633dc492d9f0539daa09b3ea8dd470";

    expect(actual).toBe(expected);
  });

  it("should generate a checksum with multiple fields", () => {
    const index: SearchIndex = {
      name: "my-index",
      fields: [
        {
          name: "my-sub-field-2",
          filterable: true,
          facetable: true,
          type: "Edm.String",
        },
        {
          type: "Edm.Int64",
          name: "my-sub-field",
          filterable: true,
        },
      ],
    };

    const actual = generateIndexChecksum(index);
    const expected = "84620f5ff602168095dc3cff07a8a67edc2e21dc";

    expect(actual).toBe(expected);
  });

  it("should deterministically generate a checksum with fields, indifferent to array order", () => {
    const index: SearchIndex = {
      name: "my-index",
      fields: [
        {
          type: "Edm.Int64",
          name: "my-sub-field",
          filterable: true,
        },
        {
          name: "my-sub-field-2",
          filterable: true,
          facetable: true,
          type: "Edm.String",
        },
      ],
    };

    const actual = generateIndexChecksum(index);
    const expected = "84620f5ff602168095dc3cff07a8a67edc2e21dc";

    expect(actual).toBe(expected);
  });
});

describe("data source", () => {
  it("should generate a checksum", () => {
    const dataSource: SearchIndexerDataSourceConnection = {
      name: "my-datasource",
      type: "azuresql",
      container: {
        name: "dbo.my-container",
      },
      connectionString: "MyConnectionString",
    };

    const actual = generateDataSourceChecksum(dataSource);
    const expected = "d56cba7f1ad641278bcb6350b5c8e1c0e8dbbb88";

    expect(actual).toBe(expected);
  });

  it("should deterministically generate a checksum, indifferent to object order", () => {
    const dataSource: SearchIndexerDataSourceConnection = {
      container: {
        name: "dbo.my-container",
      },
      type: "azuresql",
      connectionString: "MyConnectionString",
      name: "my-datasource",
    };

    const actual = generateDataSourceChecksum(dataSource);
    const expected = "d56cba7f1ad641278bcb6350b5c8e1c0e8dbbb88";

    expect(actual).toBe(expected);
  });

  it("should ignore unmanaged fields", () => {
    const dataSource: SearchIndexerDataSourceConnection = {
      name: "my-datasource",
      type: "azuresql",
      container: {
        name: "dbo.my-container",
      },
      connectionString: "MyConnectionString",
      etag: "my-etag",
    };

    const actual = generateDataSourceChecksum(dataSource);
    const expected = "d56cba7f1ad641278bcb6350b5c8e1c0e8dbbb88";

    expect(actual).toBe(expected);
  });

  it("should recognize changes in value", () => {
    const dataSource: SearchIndexerDataSourceConnection = {
      name: "my-datasource",
      type: "azuresql",
      container: {
        name: "dbo.my-container2",
      },
      connectionString: "MyConnectionString",
      etag: "my-etag",
    };

    const actual = generateDataSourceChecksum(dataSource);
    const expected = "d56cba7f1ad641278bcb6350b5c8e1c0e8dbbb88";

    expect(actual).not.toBe(expected);
  });

  it("should recognize changes in value", () => {
    const dataSource: SearchIndexerDataSourceConnection = {
      name: "my-datasource",
      type: "azuresql",
      container: {
        name: "dbo.my-container",
      },
      connectionString: "MyConnectionString2",
      etag: "my-etag",
    };

    const actual = generateDataSourceChecksum(dataSource);
    const expected = "d56cba7f1ad641278bcb6350b5c8e1c0e8dbbb88";

    expect(actual).not.toBe(expected);
  });
});
