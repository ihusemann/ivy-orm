import {
  SearchIndexClient,
  SearchIndexerClient,
} from "@azure/search-documents";
import { string, TypeOf } from "@drizzle-team/brocli";
import path from "path";
import { readConfig } from "src/util/config";
import { ensureCredential } from "src/util/credential";
import { readSchema } from "src/util/schema";

export const baseOptions = {
  schema: string().desc(
    "path to the schema file. overrides schema defined in the config file."
  ),
  cwd: string().desc("the working directory.").default(process.cwd()),
  config: string()
    .desc('path to the config file.  Defaults to "ivy-kit.config.ts".')
    .default("ivy-kit.config.ts"),
};

export async function baseTransform<T extends object = {}>(
  opts: TypeOf<typeof baseOptions & T>
) {
  const configFilePath = path.join(opts.cwd, opts.config);
  const config = readConfig(configFilePath);

  await ensureCredential(config.credential);

  const schema = opts.schema || config.schema;

  // read & parse schema
  const schemaExports = readSchema(path.join(opts.cwd, schema));

  const searchIndexClient = new SearchIndexClient(
    config.endpoint,
    config.credential
  );
  const searchIndexerClient = new SearchIndexerClient(
    config.endpoint,
    config.credential
  );

  return {
    ...opts,
    ...config,
    schema,
    schemaExports,
    searchIndexClient,
    searchIndexerClient,
  };
}
