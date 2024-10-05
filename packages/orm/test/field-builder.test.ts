import { describe, expect, it } from "vitest";
import {
  boolean,
  booleanCollection,
  collection,
  date,
  dateCollection,
  double,
  doubleCollection,
  int32,
  int32Collection,
  int64,
  int64Collection,
  string,
  stringCollection,
} from "../src/index";

export const defaultFieldProperties = {
  key: false,
  hidden: false,
  searchable: false,
  sortable: false,
  filterable: false,
  facetable: false,
  analyzerName: undefined,
  indexAnalyzerName: undefined,
  searchAnalyzerName: undefined,
  synonymMapNames: [],
  vectorSearchDimensions: undefined,
  vectorSearchProfileName: undefined,
  synonymMaps: [],
};

describe("SimpleFieldBuilder", () => {
  it("should create a simple string field with correct properties", () => {
    const field = string("name").searchable().filterable().build();

    const expected = {
      ...defaultFieldProperties,
      name: "name",
      type: "Edm.String",
      searchable: true,
      filterable: true,
    };
    expect(field).toEqual(expected);
  });

  it("should correctly set key", () => {
    const field = string("name").key().build();

    expect(field.key).toBe(true);
  });

  describe("Field Types", () => {
    it("should handle string fields", () => {
      const field = string("name").build();

      expect(field.type).toBe("Edm.String");
    });

    it("should handle int32 fields", () => {
      const field = int32("name").build();

      expect(field.type).toBe("Edm.Int32");
    });

    it("should handle int64 fields", () => {
      const field = int64("name").build();

      expect(field.type).toBe("Edm.Int64");
    });

    it("should handle boolean fields", () => {
      const field = boolean("name").build();

      expect(field.type).toBe("Edm.Boolean");
    });

    it("should handle date fields", () => {
      const field = date("name").build();

      expect(field.type).toBe("Edm.DateTimeOffset");
    });

    it("should handle double fields", () => {
      const field = double("name").build();

      expect(field.type).toBe("Edm.Double");
    });

    it("should handle string collection fields", () => {
      const field = stringCollection("name").build();

      expect(field.type).toBe("Collection(Edm.String)");
    });

    it("should handle int32 collection fields", () => {
      const field = int32Collection("name").build();

      expect(field.type).toBe("Collection(Edm.Int32)");
    });

    it("should handle int64 collection fields", () => {
      const field = int64Collection("name").build();

      expect(field.type).toBe("Collection(Edm.Int64)");
    });

    it("should handle boolean collection fields", () => {
      const field = booleanCollection("name").build();

      expect(field.type).toBe("Collection(Edm.Boolean)");
    });

    it("should handle date collection fields", () => {
      const field = dateCollection("name").build();

      expect(field.type).toBe("Collection(Edm.DateTimeOffset)");
    });

    it("should handle double collection fields", () => {
      const field = doubleCollection("name").build();

      expect(field.type).toBe("Collection(Edm.Double)");
    });
  });
});

describe("ComplexField", () => {
  it("should handle complex collection fields", () => {
    const field = collection("name", {
      field: string("field"),
    }).build();

    expect(field).toEqual({
      name: "name",
      type: "Collection(Edm.ComplexType)",
      fields: [
        {
          ...defaultFieldProperties,
          name: "field",
          type: "Edm.String",
        },
      ],
    });
  });

  it("should handle complex collection fields types", () => {
    const field = collection("name", {
      field: string("field"),
    }).build();

    expect(field.type).toBe("Collection(Edm.ComplexType)");
  });

  // it("should disallow complex field name mismatch", () => {
  //   const field = collection("name", {
  //     field: string("notField"),
  //   }).build();
  // });
});
