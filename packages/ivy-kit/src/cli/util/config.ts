// import { cosmiconfig } from "cosmiconfig";
import { z, ZodError } from "zod";
import { TokenCredential } from "@azure/identity";
import chalk from "chalk";
import { cosmiconfig } from "cosmiconfig";
import { safeRegister } from "./schema";

// const { cosmiconfig } = require("cosmiconfig")

const explorer = cosmiconfig("ivy-kit");

function isTokenCredential(credential: any): credential is TokenCredential {
  try {
    return typeof credential.getToken === "function";
  } catch {
    return false;
  }
}

const configSchema = z.object({
  schema: z.string().optional().default("search/indexes.ts"),
  endpoint: z.string().url(),
  credential: z.any().refine(isTokenCredential),
});

export type Config = z.infer<typeof configSchema>;

export const getConfig = async (cwd: string): Promise<Config> => {
  const { unregister } = await safeRegister();
  const result = await explorer.search(cwd);

  if (!result)
    throw new Error(
      `Configuration is missing.  Please add ${chalk.green("ivy-kit.config.ts")} to your project root.`
    );

  try {
    const config = configSchema.parse(result.config.default);

    return config;
  } catch (e) {
    console.log(JSON.stringify(e));
    if (e instanceof ZodError) {
      const message = `Invalid configuration at '${result.filepath}'.\nField(s) ${Object.keys(
        e.flatten().fieldErrors
      ).join(", ")} are invalid.`;
      throw new Error(chalk.red(message));
    }
    throw new Error("Could not parse configuration.");
  } finally {
    unregister();
  }
};

export function defineConfig(options: Config): Config {
  return options;
}
