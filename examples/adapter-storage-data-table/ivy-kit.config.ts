import "dotenv/config";
import { Config } from "ivy-kit";
import { AzureCliCredential } from "@azure/identity";
import { DataTableAdapter } from "./data-table.adapter";

const endpoint = process.env.ENDPOINT;

if (!endpoint)
  throw new Error("Missing environment variable ENDPOINT.  Add it to .env.");

export default {
  credential: new AzureCliCredential(),
  schema: "search/schema.ts",
  endpoint,
  adapter: new DataTableAdapter(),
} satisfies Config;
