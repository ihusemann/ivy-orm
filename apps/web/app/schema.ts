import { string, index, int32 } from "orm/schema";

export const realEstate = index("realestate-us-sample-index", {
  listingId: string("listingId").key(),
  beds: int32("beds").filterable().sortable().facetable(),
  baths: int32("baths").filterable().sortable().facetable(),
  description: string("description").searchable(),
  sqft: int32("sqft").filterable().sortable().facetable(),
});
