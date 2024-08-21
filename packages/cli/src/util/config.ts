import { type TokenCredential } from "@azure/identity";
import { cosmiconfig } from "cosmiconfig";
import { z, ZodError } from "zod";
import chalk from "chalk";

const explorer = cosmiconfig("ivy-kit");

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

export const safeRegister = async () => {
  const { register } = await import("esbuild-register/dist/node");
  let res: { unregister: () => void };
  try {
    res = register({
      format: "cjs",
      loader: "ts",
    });
  } catch {
    // tsx fallback
    res = {
      unregister: () => {},
    };
  }
  return res;
};

export const getConfig = async (cwd: string): Promise<Config> => {
  // console.log("HERE!");
  // const { unregister } = await safeRegister();
  // console.log("SAFE REGISTER");
  const result = await explorer.search(cwd);
  // console.log("HERE");

  if (!result)
    throw new Error(
      `Configuration is missing.  Please add ${chalk.green("ivy-kit.config.ts")} to your project root.`
    );

  try {
    const config = configSchema.parse(result.config.default);

    return config;
  } catch (e) {
    if (e instanceof ZodError) {
      const message = `Invalid configuration at '${result.filepath}'.\nField(s) ${Object.keys(
        e.flatten().fieldErrors
      ).join(", ")} are invalid.`;
      throw new Error(chalk.red(message));
    }
    throw new Error("Could not parse configuration.");
  } finally {
    // unregister();
  }
};
