import { index, int32, string } from "azure-ai-search-orm";

export const realEstate = index("realestate-us-sample-index", {
  listingId: string("listingId").key(),
  beds: int32("bes").sortable().facetable(),
  baths: int32("baths").sortable().facetable(),
  description: string("description").searchable(),
  sqft: int32("sqft").sortable().facetable(),
  street: string("street").searchable(),
});
