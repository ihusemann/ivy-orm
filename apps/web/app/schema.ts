import { string, index, int32 } from "azure-ai-search-orm";

export const realEstate = index("realestate-us-sample-index", {
  listingId: string("listingId").key(),
  beds: int32("beds").filterable().sortable().facetable().notNull(),
  baths: int32("baths").filterable().sortable().facetable().notNull(),
  description: string("description").searchable().notNull(),
  sqft: int32("sqft").filterable().sortable().facetable().notNull(),
});
