import { command } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import { ensureAdapter } from "src/util/adapter";
import {
  generateIndexChecksum,
  generateIndexerChecksum,
} from "src/migrate/checksum";

const options = baseOptions;

export const diff = command({
  name: "diff",
  options,
  transform: baseTransform<typeof options>,
  handler: async ({ adapter, schemaExports: { indexes, indexers } }) => {
    ensureAdapter(adapter);

    const stateResources = await adapter.listResources();

    console.log("\nComparing indexes:");
    Object.values(indexes).forEach((localIndex) => {
      const stateIndex = stateResources.find(
        ({ name }) => name === localIndex.name
      );

      if (!stateIndex)
        throw new Error(`state missing index ${localIndex.name}`);

      const schemaChecksum = generateIndexChecksum(localIndex["build"]());

      if (stateIndex.checksum !== schemaChecksum) {
        console.log(`${localIndex.name} DOES NOT MATCH`);
      } else {
        console.log(`${localIndex.name} good`);
      }
    });

    console.log("\nComparing indexers:");
    Object.values(indexers).forEach((localIndex) => {
      const stateIndex = stateResources.find(
        ({ name }) => name === localIndex.name
      );

      if (!stateIndex)
        throw new Error(`state missing indexer ${localIndex.name}`);

      console.dir(localIndex["build"](), {
        depth: null,
      });
      const schemaChecksum = generateIndexerChecksum(localIndex["build"]());

      if (stateIndex.checksum !== schemaChecksum) {
        console.log(`${localIndex.name} DOES NOT MATCH`);
      } else {
        console.log(`${localIndex.name} good`);
      }
    });
  },
});
