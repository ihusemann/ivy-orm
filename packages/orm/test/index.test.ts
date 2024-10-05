import {
  index,
  string,
  int32,
  collection,
  InferType,
  int64,
  double,
  boolean,
  date,
  stringCollection,
  booleanCollection,
  dateCollection,
  doubleCollection,
  int32Collection,
  int64Collection,
  complex,
} from "../src/index";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defaultFieldProperties } from "./field-builder.test";

describe("Index", () => {
  it("should create an index with correct fields", () => {
    const realEstate = index("realestate-index", {
      id: string("listingId").key(),
      beds: int32("beds").sortable().facetable().notNull(),
      baths: int32("baths").sortable().facetable().notNull(),
    });

    expect(realEstate.name).toBe("realestate-index");
    expect(realEstate.fields).toEqual([
      {
        ...defaultFieldProperties,
        name: "id",
        type: "Edm.String",
        key: true,
      },
      {
        ...defaultFieldProperties,
        name: "beds",
        type: "Edm.Int32",
        sortable: true,
        facetable: true,
      },
      {
        ...defaultFieldProperties,
        name: "baths",
        type: "Edm.Int32",
        sortable: true,
        facetable: true,
      },
    ]);
    expectTypeOf<{ id: string; beds: number; baths: number }>(
      <InferType<typeof realEstate>>{}
    );
  });

  it("should create suggesters when fields have suggesters", () => {
    const realEstate = index("realestate-index", {
      id: string("listingId").key(),
      description: string("description").searchable().suggester(),
    });

    expect(realEstate.suggesters).toEqual([
      {
        name: "sg",
        searchMode: "analyzingInfixMatching",
        sourceFields: ["description"],
      },
    ]);
  });

  it("should not create suggesters when no fields have suggesters", () => {
    const realEstate = index("realestate-index", {
      id: string("listingId").key(),
      beds: int32("beds").sortable().facetable(),
    });

    expect(realEstate.suggesters).toEqual([]);
  });

  describe("generateFieldMappings", () => {
    it("should not generate field mappings when all field names match", () => {
      const myIndex = index("index", {
        name: string("name"),
      });

      expect(myIndex.implicitFieldMappings).toEqual([]);
    });

    it("should generate correct field mappings", () => {
      const myIndex = index("my-index", {
        id: string("listingId").key(),
        beds: int32("beds").facetable(),
        description: string("desc").searchable(),
      });

      expect(myIndex.implicitFieldMappings).toEqual([
        { targetFieldName: "id", sourceFieldName: "listingId" },
        { targetFieldName: "description", sourceFieldName: "desc" },
      ]);
    });

    it("should exclude complex fields from mappings", () => {
      const myIndex = index("my-index", {
        id: string("listingId").key(),
        beds: int32("beds").facetable(),
        description: string("desc").searchable(),
        addresses: collection("addresses", {
          street: string("myStreet"),
        }),
      });

      expect(myIndex.implicitFieldMappings).toEqual([
        { targetFieldName: "id", sourceFieldName: "listingId" },
        { targetFieldName: "description", sourceFieldName: "desc" },
      ]);
    });

    it("should correctly infer field types", () => {
      const myIndex = index("index", {
        id: string("id").key(),
        stringNullable: string("string"),
        string: string("string").notNull(),
        int32Nullable: int32("int32"),
        int32: int32("int32").notNull(),
        int64Nullable: int64("int64"),
        int64: int64("int64").notNull(),
        doubleNullable: double("double"),
        double: double("double").notNull(),
        booleanNullable: boolean("boolean"),
        boolean: boolean("boolean").notNull(),
        dateNullable: date("date"),
        date: date("date").notNull(),
        stringCollectionNullable: stringCollection("stringCollection"),
        stringCollection: stringCollection("stringCollection").notNull(),
        int32CollectionNullable: int32Collection("int32Collection"),
        int32Collection: int32Collection("int32Collection").notNull(),
        int64CollectionNullable: int64Collection("int64Collection"),
        int64Collection: int64Collection("int64Collection").notNull(),
        doubleCollectionNullable: doubleCollection("doubleCollection"),
        doubleCollection: doubleCollection("doubleCollection").notNull(),
        booleanCollectionNullable: booleanCollection("booleanCollection"),
        booleanCollection: booleanCollection("booleanCollection").notNull(),
        dateCollectionNullable: dateCollection("dateCollection"),
        dateCollection: dateCollection("dateCollection").notNull(),
        collection: collection("collection", {
          string: string("string").notNull(),
        }),
        complex: complex("complex", {
          string: string("string").notNull(),
        }),
      });

      expectTypeOf<{
        id: string;
        stringNullable: string | null;
        string: string;
        int32Nullable: number | null;
        int32: number;
        int64Nullable: number | null;
        int64: number;
        doubleNullable: number | null;
        double: number;
        dateNullable: Date | null;
        date: Date;
        stringCollectionNullable: string[] | null;
        stringCollection: string[];
        int32CollectionNullable: number[] | null;
        int32Collection: number[];
        int64CollectionNullable: number[] | null;
        int64Collection: number[];
        doubleCollectionNullable: number[] | null;
        doubleCollection: number[];
        dateCollectionNullable: Date[] | null;
        dateCollection: Date[];
        collection: { string: string }[];
        complex: { string: string };
      }>(<InferType<typeof myIndex>>{});
    });
  });
});
