import { SearchIndexClient } from "@azure/search-documents";
import chalk from "chalk";

export async function getExistingIndexes(client: SearchIndexClient) {
  try {
    const results = client.listIndexesNames();

    const names: string[] = [];
    for await (const result of results) {
      names.push(result);
    }

    return names;
  } catch {
    throw new Error(
      `${chalk.bold.red("Error:")} failed to fetch existing indexes.  Please try again.`
    );
  }
}
