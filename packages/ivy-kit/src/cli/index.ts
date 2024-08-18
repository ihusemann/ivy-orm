import { command, run, string } from "@drizzle-team/brocli";
import fs from "fs";
import path from "path";
import { readSchema } from "./util/schema";
import prompts from "prompts";
import { AnyIndex, AnyIndexer } from "ivy-orm";
import { getExistingIndexes } from "./util/ai-search";
import ora from "ora";
import pluralize from "pluralize";
import chalk from "chalk";
import {
  SearchIndexClient,
  SearchIndexerClient,
} from "@azure/search-documents";
import { getConfig } from "./util/config";

const push = command({
  name: "push",
  options: {
    // schema: string().required().desc("the path to the schema file."),
    cwd: string()
      .desc("the working directory. defaults to the current directory.")
      .default(process.cwd()),
  },
  transform: async (opts) => {
    const config = await getConfig(opts.cwd);

    return {
      ...opts,
      ...config,
    };
  },
  handler: async (opts) => {
    const file = path.join(opts.cwd, opts.schema);

    const { indexes, indexers } = await readSchema(file);

    if (Object.keys(indexes).length === 0) {
      throw new Error(
        `${chalk.bold.red("Error:")} schema file must define at least one index.`
      );
    }

    if (Object.keys(indexers).length === 0) {
      throw new Error(
        `${chalk.bold.red("Error:")} schema file must define at least one indexer.`
      );
    }

    const searchIndexClient = new SearchIndexClient(
      opts.endpoint,
      opts.credential
    );

    const response = await prompts({
      type: "multiselect",
      name: "indexes",
      message: "Which indexes would you like to create/update?",
      hint: "Space to select. A to toggle all. Enter to submit.",
      instructions: false,
      choices: Object.entries(indexes).map(([name, index]) => ({
        title: name,
        description: index.name,
        value: index,
      })),
    });

    const conflictsSpinner = ora("Checking for conflicts...").start();
    const existingIndexes = await getExistingIndexes(
      opts.endpoint,
      opts.credential
    ); // todo: pass searchIndexClient instead?

    const overwrite = (response.indexes as AnyIndex[]).filter(({ name }) =>
      existingIndexes.includes(name)
    );

    conflictsSpinner.stop();

    if (overwrite.length > 0) {
      const confirm = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `This operation will overwrite ${pluralize("index", overwrite.length)} ${overwrite.map(({ name }) => chalk.green(name)).join(", ")}.  Continue?`,
      });

      if (!confirm.overwrite) process.exit(0);
    }

    const createSpinner = ora("Creating indexes...").start();

    for await (const index of response.indexes as AnyIndex[]) {
      if (overwrite.includes(index)) {
        createSpinner.text = `Deleting ${index.name}...`;
        await searchIndexClient.deleteIndex(index.name);
      }

      createSpinner.text = `Creating ${index.name}...`;
      await searchIndexClient.createIndex(index["build"]());
    }

    const listResults = searchIndexClient.listIndexesNames();

    const allIndexes: string[] = [];
    for await (const index of listResults) {
      allIndexes.push(index);
    }

    createSpinner.succeed();

    const idxrResponse = await prompts({
      type: "multiselect",
      name: "indexers",
      message: "Which indexers would you like to create/update?",
      hint: "Space to select. A to toggle all. Enter to submit.",
      instructions: false,
      choices: Object.entries(indexers).map(([name, indexer]) => ({
        title: name,
        description: indexer.name,
        value: indexer,
        disabled: !allIndexes.includes(indexer.targetIndexName),
      })),
    });

    const searchIndexerClient = new SearchIndexerClient(
      opts.endpoint,
      opts.credential
    );

    const indexersConflictsSpinner = ora("Checking for conflicts...").start();

    const existingIndexers = await searchIndexerClient.listIndexersNames();

    const overwriteIndexers = (idxrResponse.indexers as AnyIndexer[]).filter(
      ({ name }) => existingIndexers.includes(name)
    );

    indexersConflictsSpinner.stop();

    if (overwriteIndexers.length > 0) {
      const confirm = await prompts({
        type: "confirm",
        name: "overwrite",
        message: `This operation will overwrite ${pluralize("indexer", overwriteIndexers.length)} ${overwriteIndexers.map(({ name }) => chalk.green(name)).join(", ")}.  Continue?`,
      });

      if (!confirm.overwrite) process.exit(0);
    }

    const createIndexerSpinner = ora("Creating indexers...").start();
    for await (const indexer of idxrResponse.indexers as AnyIndexer[]) {
      if (overwriteIndexers.includes(indexer)) {
        createIndexerSpinner.text = `Deleting indexer ${indexer.name}`;
        await searchIndexerClient.deleteIndexer(indexer.name);
      }
      createIndexerSpinner.text = `Creating indexer ${indexer.name}`;
      await searchIndexerClient.createIndexer(indexer);
    }

    createIndexerSpinner.succeed();
  },
});

run([push]);
