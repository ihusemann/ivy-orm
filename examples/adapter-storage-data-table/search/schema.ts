import { index, indexer, int32, string } from "ivy-orm";

export const realEstate = index("realestate-sample-index", {
  id: string("listingId").key(),
  beds: int32("beds").sortable().facetable(),
  baths: int32("baths").sortable().facetable(),
  description: string("description").searchable(),
  sqft: int32("sqft").facetable(),
  street: string("street").searchable(),
});

export const realEstateIndexer = indexer("realestate-sample-indexer-foobar", {
  targetIndex: realEstate,
  dataSourceName: "realestate-us-sample-foobar",
  fieldMappings: [
    {
      sourceFieldName: "listingId",
      targetFieldName: "id",
      mappingFunction: {
        name: "base64Encode",
      },
    },
  ],
});
