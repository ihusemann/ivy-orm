import { boolean, command } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import prompts from "prompts";
import { SearchIndex } from "@azure/search-documents";
import chalk from "chalk";
import { ensureAdapter } from "src/util/adapter";
import {
  DataSourceResource,
  IndexerResource,
  IndexResource,
} from "src/migrate/types";
import {
  isDataSourceResource,
  isIndexerResource,
  isIndexResource,
} from "src/migrate/guards";

const options = {
  ...baseOptions,
};

export const plan = command({
  name: "plan",
  desc: "(beta) add existing indexes and indexers to the ivy-kit state.",
  options,
  transform: baseTransform<typeof options>,
  handler: async ({ searchIndexClient, searchIndexerClient, adapter }) => {
    ensureAdapter(adapter);

    await adapter.initialize?.();

    const resources = await adapter.listResources();

    const stateResources = resources.reduce(
      (resources, resource) => {
        if (isIndexResource(resource)) {
          resources.stateIndexes.push(resource);
          return resources;
        }

        if (isIndexerResource(resource)) {
          resources.stateIndexers.push(resource);
          return resources;
        }

        if (isDataSourceResource(resource)) {
          resources.stateDataSources.push(resource);
          return resources;
        }

        throw new Error("Invalid resource found in state.  Aborting.");
      },
      {
        stateIndexes: [],
        stateIndexers: [],
        stateDataSources: [],
      } as {
        stateIndexes: IndexResource[];
        stateIndexers: IndexerResource[];
        stateDataSources: DataSourceResource[];
      }
    );

    console.log(stateResources);
  },
});
