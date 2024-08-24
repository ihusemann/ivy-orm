import { type TokenCredential } from "@azure/identity";
import { z } from "zod";

function isTokenCredential(credential: any): credential is TokenCredential {
  try {
    return typeof credential.getToken === "function";
  } catch {
    return false;
  }
}

export const configSchema = z.object({
  schema: z.string().optional().default("search/indexes.ts"),
  endpoint: z.string().url(),
  credential: z.any().refine(isTokenCredential),
});

export type Config = {
  schema?: string;
  endpoint: string;
  credential: TokenCredential;
};
