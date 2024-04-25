import { DefaultAzureCredential } from "@azure/identity";
import { SearchIndexClient } from "@azure/search-documents";
import { connect } from "orm";
import * as schema from "./schema";

export default async function Page() {
  const endpoint = process.env.AZURE_AI_SEARCH_ENDPOINT!;
  const identity = new DefaultAzureCredential();

  const searchIndexClient = new SearchIndexClient(endpoint, identity);

  const srch = connect(searchIndexClient, schema);

  const data = await srch.realEstate.search(undefined, {
    top: 20,
    select: ["listingId", "description"],
  });

  const results = [];

  for await (const result of data.results) {
    results.push(result.document);
  }

  return <div>{JSON.stringify(results)}</div>;
}
