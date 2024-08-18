import { TokenCredential } from "@azure/identity";
import { SearchIndexClient } from "@azure/search-documents";

export async function getExistingIndexes(
  endpoint: string,
  credential: TokenCredential
) {
  const client = new SearchIndexClient(endpoint, credential);

  try {
    const results = client.listIndexesNames();

    const names: string[] = [];
    for await (const result of results) {
      names.push(result);
    }

    return names;
  } catch (e) {
    throw new Error(JSON.stringify(e));
  }
}
