import { boolean, command } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import prompts from "prompts";
import { SearchIndex } from "@azure/search-documents";
import chalk from "chalk";

/**
 * pull into the state indexes and indexers that don't already exist in the state.
 * Provide an option to allow developers to force overwrite local resources.
 */

const options = {
  ...baseOptions,
  force: boolean()
    .alias("-f")
    .default(false)
    .desc("allow overwriting resources that exist in the local state"),
};

export const pull = command({
  name: "pull",
  desc: "(beta) add existing indexes and indexers to the ivy-kit state.",
  options,
  transform: baseTransform<typeof options>,
  handler: async ({
    searchIndexClient,
    searchIndexerClient,
    adapter,
    force,
  }) => {
    const indexIterator = searchIndexClient.listIndexes();

    const ora = (await import("ora")).default;

    const indexSpinner = ora("Fetching indexes...").start();

    const existingState = await adapter.listResources();

    const existingIndexes = existingState.filter(
      ({ type }) => type === "index"
    );

    const existingIndexNames = existingState
      .filter(({ type }) => type === "index")
      .map(({ name }) => name);

    const indexes = [];
    for await (const index of indexIterator) {
      // exclude indexes that already exist in the state, by default.
      if (!force && existingIndexNames.includes(index.name)) continue;

      // always exclude indexes that exist in the state with a matching etag.
      if (
        force &&
        existingIndexNames.includes(index.name) &&
        existingIndexes.findIndex(({ etag }) => index.etag === etag) !== -1
      )
        continue;

      indexes.push({
        name: index.name,
        etag: index.etag,
      });
    }

    indexSpinner.stop();

    const [idxResponse, indexers] = await Promise.all([
      prompts({
        type: "multiselect",
        name: "indexes",
        message: "Which indexes would you like to pull?",
        hint: "Space to select. A to toggle all. Enter to submit.",
        instructions: false,
        choices: indexes.map((index) => ({
          title: index.name,
          value: index,
          description: existingIndexNames.includes(index.name)
            ? "(Overwrites existing)"
            : undefined,
        })),
      }),
      searchIndexerClient.listIndexers(),
    ]);

    // Ensure some indexes are selected
    if (!idxResponse.indexes || idxResponse.indexes.length === 0) {
      throw new Error("No indexes were selected. Aborting.");
    }

    const idxrResponse = await prompts({
      type: "multiselect",
      name: "indexers",
      message: "Which indexers would you like to pull?",
      hint: "Space to select. A to toggle all. Enter to submit.",
      instructions: false,
      choices: indexers.map(({ name, etag, targetIndexName }) => ({
        title: name,
        value: { name, etag, targetIndexName },
        selected:
          (idxResponse.indexes as SearchIndex[]).findIndex(
            ({ name }) => targetIndexName === name
          ) !== -1,
      })),
    });

    // Ensure some indexers are selected
    if (!idxrResponse.indexers || idxrResponse.indexers.length === 0) {
      throw new Error("No indexers were selected. Aborting.");
    }

    // TODO: handle checksums
    const updateStateSpinner = ora("Updating state...").start();
    const idxPromises = (
      idxResponse.indexes as { name: string; etag: string }[]
    ).map((index) =>
      adapter.createResource({
        type: "index",
        ...index,
        checksum: "",
      })
    );

    const idxrPromises = (
      idxrResponse.indexers as { name: string; etag: string }[]
    ).map(({ name, etag }) =>
      adapter.createResource({
        type: "indexer",
        name,
        etag,
        checksum: "",
      })
    );
    try {
      await Promise.all([...idxPromises, ...idxrPromises]);
      updateStateSpinner.succeed();
      ora("Done!").succeed();
    } catch {
      updateStateSpinner.fail();

      console.log(
        `${chalk.red.bold("Error:")} something went wrong while updating the state, and some data may not have been written.  Please try again.`
      );
    }
  },
});
