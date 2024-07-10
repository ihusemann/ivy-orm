import "dotenv/config";
import { connect } from "azure-ai-search-orm";
import * as schema from "./indexes";
import { DefaultAzureCredential } from "@azure/identity";
import { SearchIndexClient } from "@azure/search-documents";

const main = async () => {
  const credential = new DefaultAzureCredential();

  const searchIndexClient = new SearchIndexClient(
    process.env["AI_SEARCH_ENDPOINT"]!,
    credential
  );

  const srch = connect(searchIndexClient, schema);

  const searchResults = await srch.realEstate.search(undefined, { top: 10 });

  const documents = [];
  for await (const result of searchResults.results) {
    documents.push(result.document);
  }

  console.log(documents);

  process.exit(0);
};

main();
