import { boolean, string, TypeOf } from "@drizzle-team/brocli";
import chalk from "chalk";
import { cosmiconfig } from "cosmiconfig";
import path from "path";
import { configSchema } from "src/util/config";
import { readSchema } from "src/util/schema";
import { ZodError } from "zod";

export const baseOptions = {
  schema: string().desc(
    "path to the schema file. overrides schema defined in ivy-kit.config.ts."
  ),
  cwd: string().desc("the working directory.").default(process.cwd()),
  force: boolean()
    .alias("-f")
    .default(false)
    .desc("don't prompt to overwrite existing indexes/indexers/data sources."),
};

export async function baseTransform(opts: TypeOf<typeof baseOptions>) {
  // read & parse config
  const explorer = cosmiconfig("ivy-kit");
  const result = await explorer.search(opts.cwd);

  if (!result)
    throw new Error(
      `Configuration is missing.  Please add ${chalk.green("ivy-kit.config.ts")} to your project root.`
    );

  try {
    const config = configSchema.parse(result.config);

    const schema = opts.schema || config.schema;

    // read & parse schema
    const schemaExports = readSchema(path.join(opts.cwd, schema));

    return {
      ...opts,
      ...config,
      schema,
      schemaExports,
    };
  } catch (e) {
    if (e instanceof ZodError) {
      const message = `Invalid configuration at '${result.filepath}'.\nField(s) ${Object.keys(
        e.flatten().fieldErrors
      ).join(", ")} are invalid.`;
      throw new Error(chalk.red(message));
    }
    throw new Error("Could not parse configuration.");
  }
}
