import { index, string, int32, collection } from "../src/index";
import { describe, expect, it } from "vitest";
import { defaultFieldProperties } from "./field-builder.test";

describe("Index", () => {
  it("should create an index with correct fields", () => {
    const realEstate = index("realestate-index", {
      id: string("listingId").key(),
      beds: int32("beds").sortable().facetable(),
      baths: int32("baths").sortable().facetable(),
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
  });
});
