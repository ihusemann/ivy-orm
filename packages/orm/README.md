# Azure AI Search ORM

A fully type-safe "ORM" for Azure AI Search (formerly Cognitive Search) inspired by Drizzle ORM.

Define a fluent schema:

```ts
import { string, index, int32 } from "orm/schema";

export const realEstate = index("realestate-us-sample-index", {
  listingId: string("listingId").key(),
  beds: int32("beds").filterable().sortable().facetable(),
  baths: int32("baths").filterable().sortable().facetable(),
  description: string("description").searchable(),
  squareFeet: int32("sqft").filterable().sortable().facetable(),
});
```

and use all the methods you'd usually use on a SearchClient, but with excellent TypeScript support:

```ts
const searchIndexClient = new SearchIndexClient(endpoint, identity);

const srch = connect(searchIndexClient, schema);

const data = await srch.realEstate.search(undefined, {
  top: 20,
  select: ["listingId", "description"],
});
```

Field names in the ORM don't need to match the names in the datasource:

```ts
export const realEstate = index("realestate-us-sample-index", {
  squareFeet: int32("sqft").filterable().sortable().facetable(),
  // ^ORM field name  ^datasource column name
});
```
