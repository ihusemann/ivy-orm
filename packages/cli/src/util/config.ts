import { type TokenCredential } from "@azure/identity";
import { z } from "zod";
import { Adapter } from "./migrate";

function isTokenCredential(credential: any): credential is TokenCredential {
  try {
    return typeof credential.getToken === "function";
  } catch {
    return false;
  }
}

function isAdapter(adapter: any): adapter is Adapter {
  try {
    return typeof adapter.listResources === "function";
  } catch {
    return false;
  }
}

export const configSchema = z.object({
  schema: z.string().optional().default("search/indexes.ts"),
  endpoint: z.string().url(),
  credential: z.any().refine(isTokenCredential),
  adapter: z.any().refine(isAdapter),
  out: z.string().optional().default("migrations"),
});

export type Config = {
  schema?: string;
  endpoint: string;
  credential: TokenCredential;
  adapter: Adapter;

  /**
   * migrations output directory path, relative to the schema directory
   */
  out?: string;
};
