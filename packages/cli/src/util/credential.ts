import { TokenCredential } from "@azure/identity";
import { AzureKeyCredential } from "@azure/search-documents";
import chalk from "chalk";
import ora from "ora";
import { isAzureKeyCredential } from "./config";

/**
 * Ensures the provided credential is valid, and errors if not.
 * @param credential TokenCredential
 */
export async function ensureCredential(
  credential: TokenCredential | AzureKeyCredential
) {
  if (isAzureKeyCredential(credential)) return;

  const spinner = ora("Checking credential...").start();

  try {
    const res = await credential.getToken(`https://search.azure.com/.default`);

    if (!res) {
      throw new Error();
    }
    spinner.stop();
  } catch {
    spinner.stop();
    throw new Error(
      `${chalk.red.bold("Error:")} Couldn't fetch access token.  Please ensure credential is valid.`
    );
  }
}
