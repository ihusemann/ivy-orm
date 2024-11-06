import { connect } from "ivy-orm";
import * as schema from "./schema";
import { SearchIndexClient } from "@azure/search-documents";
import { DefaultAzureCredential } from "@azure/identity";

const endpoint = process.env.AI_SEARCH_ENDPOINT;

if (!endpoint)
  throw new Error(
    "Missing environment variable AI_SEARCH_ENDPOINT.  Add it to .env."
  );

const client = new SearchIndexClient(endpoint, new DefaultAzureCredential());

const srch = connect(client, schema);

export { srch };
