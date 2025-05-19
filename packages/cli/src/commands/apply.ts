import { command, string } from "@drizzle-team/brocli";
import { baseOptions, baseTransform } from "./base";
import prompts from "prompts";
import {
  SearchField,
  SearchIndexClient,
  SearchIndexerClient,
} from "@azure/search-documents";
import chalk from "chalk";
import { MigrationFile } from "src/migrate/types";
import {
  computeMigrationActions,
  dataSourceHandlers,
  generateMigrationFile,
  indexHandlers,
  indexerHandlers,
} from "src/migrate/generate";
import ora from "ora";
import boxen from "boxen";
import { getBorderCharacters, table } from "table";
import { isSimpleField } from "@ivy-orm/core";
import _ from "lodash";
import { resolveSecret } from "src/migrate/secrets";

const options = {
  ...baseOptions,
  reset: string().desc(
    "Mark indexers to be reset. For multiple indexers, seperate with commas."
  ),
  run: string().desc(
    "Mark indexers to be run. For multiple indexers, seperate with commas."
  ),
};

const glyph = {
  create: chalk.greenBright("+"),
  update: chalk.yellowBright("~"),
  delete: chalk.redBright("-"),
  replace: chalk.magentaBright("-/+"),
};

const tick = (v?: boolean) => (v ? chalk.greenBright("✓") : chalk.gray("·"));

/* ---------- NEW — build a table for index fields ---------- */

function generateRow(
  field: SearchField,
  prefixSegments: string[] = []
): string[][] {
  if (!isSimpleField(field)) {
    const complexField = [
      "+",
      chalk.gray(`${"".padStart(prefixSegments.length, "  ")}${field.name}`),
      // chalk.cyan(
      //   `${"".padStart(prefixSegments.length, " ")}${[...prefixSegments, field.name].join(".")}`
      // ),
      chalk.gray(field.type),
      "",
      "",
      "",
      "",
      "",
      "",
    ];
    return [
      ["", "", "", "", "", "", "", "", ""],
      complexField,
      ...field.fields.flatMap((f) =>
        generateRow(f, [...prefixSegments, field.name])
      ),
    ];
  }

  return [
    [
      "",
      chalk.cyan(`${"".padStart(prefixSegments.length, " ")}${field.name}`),
      // chalk.cyan([...prefixSegments, field.name].join(".")),
      field.type,
      tick(field.key),
      tick(!field.hidden),
      tick(field.searchable),
      tick(field.sortable),
      tick(field.filterable),
      tick(field.facetable),
    ],
  ];
}

function renderFieldTable(fields: SearchField[]): string {
  const headerRow = [
    "",
    chalk.bold("field"),
    chalk.bold("type"),
    chalk.bold("key"),
    chalk.bold("retrievable"),
    chalk.bold("searchable"),
    chalk.bold("sortable"),
    chalk.bold("filterable"),
    chalk.bold("facetable"),
  ];

  const rows = [];

  for (const field of fields) {
    rows.push(...generateRow(field));
  }

  /* table() returns a single string already containing newlines.  We use the
     'void' border to get a clean, minimal look, then indent every line so it
     nests under the resource heading.                                                  */
  const output = table([headerRow, ...rows], {
    border: getBorderCharacters("void"),
    columnDefault: { paddingLeft: 1, paddingRight: 1 },
    drawHorizontalLine: () => false,
  });

  return output
    .split("\n")
    .map((line) => "  " + line) // 6‑space indent matches earlier attr lines
    .join("\n");
}

export const apply = command({
  name: "apply",
  desc: "(beta)2",
  options,
  transform: baseTransform<typeof options>,
  handler: async ({
    searchIndexClient,
    searchIndexerClient,
    schemaExports: { indexes, indexers, dataSources },
  }) => {
    /**
     * 1. Read AI Search deployed schemas
     * 2. Read local schemas
     * 3. Deep compare and output the differences
     * 4. Generate migration plan
     * 5. Output migration plan
     */

    const header = boxen("Ivy Kit · execution plan (preview)", {
      padding: 1,
      margin: 1,
      align: "center",
      borderColor: "cyan",
    });
    // console.log(header);

    const spinner = ora("Fetching indexes...").start();

    const indexesIterator = searchIndexClient.listIndexes();

    const deployedIndexes = [];

    for await (const index of indexesIterator) {
      deployedIndexes.push(index);
    }

    const deployedIndexers = await searchIndexerClient.listIndexers();

    // // PRINT INDEX
    // const index = await searchIndexClient.getIndex("idx-drawings-001");

    // console.log(
    //   `\n\n${glyph.create} index ${chalk.cyan.underline(index.name)} will be created\n`
    // );
    // console.log(renderFieldTable(index.fields));

    // // CALCULATE DATA SOURCE DIFFERENCES
    const deployedDataSources = (
      await searchIndexerClient.listDataSourceConnections()
    ).map(({ name, description, ...rest }) => ({
      name,
      // ai search sdk seems to set `description` to `name` when undefined.  Breaks diff'ing logic.
      description: name === description ? undefined : description,
      ...rest,
    }));

    const indexActions = computeMigrationActions(
      Object.values(indexes),
      deployedIndexes,
      indexHandlers
    );

    const indexerActions = computeMigrationActions(
      Object.values(indexers),
      deployedIndexers,
      indexerHandlers
    );

    const dataSourceActions = computeMigrationActions(
      Object.values(dataSources),
      deployedDataSources,
      dataSourceHandlers
    );

    // TODO: print migration plan

    const migrationPlan = generateMigrationFile({
      indexActions,
      indexerActions,
      dataSourceActions,
    });

    spinner.stop();

    console.log("\n");

    // determines if any one of indexes, indexers, or dataSources has any create/delete actions
    const hasActions = Object.values(migrationPlan)
      .flatMap((actions) => {
        return Object.values(actions).map((action) => {
          return action.length > 0;
        });
      })
      .some(Boolean);

    if (!hasActions) {
      console.log(chalk.green("No changes detected.  Finishing...\n"));
      return;
    }

    console.dir(migrationPlan, { depth: null });

    console.log(`\n${chalk.bold("Plan:")}`);
    console.log(
      `  ${chalk.cyan("indexers")}: ${indexerActions.create.length} create, ${indexerActions.delete.length} delete, ${indexerActions.update.length} replace`
    );
    console.log(
      `  ${chalk.cyan("indexes")}: ${indexActions.create.length} create, ${indexActions.delete.length} delete, ${indexActions.update.length} replace`
    );
    console.log(
      `  ${chalk.cyan("dataSources")}: ${dataSourceActions.create.length} create, ${dataSourceActions.delete.length} delete, ${dataSourceActions.update.length} replace`
    );

    console.log("\n\n");

    const response = await prompts({
      type: "text",
      name: "confirm",
      message:
        'Do you want ivy-kit to perform the actions shown above?\n  Only "yes" will be accepted to approve.\n\n  Enter a value:',
    });

    if (response.confirm !== "yes") {
      console.log("Apply cancelled.");
      process.exit(1);
    }

    await applyMigrationPlan(
      migrationPlan,
      searchIndexClient,
      searchIndexerClient
    );
  },
});

async function delay(ms: number = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyMigrationPlan(
  migrationPlan: MigrationFile,
  searchIndexClient: SearchIndexClient,
  searchIndexerClient: SearchIndexerClient
) {
  // handle deletes first.  indexers, then data sources, then indexes

  const spinner = ora("Applying migration plan...").start();

  for await (const indexer of migrationPlan.indexers.delete) {
    try {
      spinner.text = `Deleting indexer ${chalk.cyan.underline(indexer.name)}`;
      await searchIndexerClient.deleteIndexer(indexer.name);
      await delay();
    } catch (e) {
      spinner.text = `Failed to delete indexer ${chalk.cyan.underline(indexer.name)}`;
      console.error(e);
      process.exit(1);
    }
  }

  for await (const dataSource of migrationPlan.dataSources.delete) {
    try {
      spinner.text = `Deleting data source ${chalk.cyan.underline(dataSource.name)}`;
      await searchIndexerClient.deleteDataSourceConnection(dataSource.name);
      await delay();
    } catch (e) {
      spinner.text = `Failed to delete data source ${chalk.cyan.underline(dataSource.name)}`;
      console.error(e);
      process.exit(1);
    }
  }

  for await (const index of migrationPlan.indexes.delete) {
    try {
      spinner.text = `Deleting index ${chalk.cyan.underline(index.name)}`;
      await searchIndexClient.deleteIndex(index.name);
      await delay();
    } catch (e) {
      spinner.text = `Failed to delete index ${chalk.cyan.underline(index.name)}`;
      console.error(e);
      process.exit(1);
    }
  }

  for await (const index of migrationPlan.indexes.create) {
    try {
      spinner.text = `Creating index ${chalk.cyan.underline(index.name)}`;
      await searchIndexClient.createIndex(index);
      await delay();
    } catch (e) {
      spinner.text = `Failed to create index ${chalk.cyan.underline(index.name)}`;
      console.error(e);
      process.exit(1);
    }
  }

  for await (const dataSource of migrationPlan.dataSources.create) {
    try {
      spinner.text = `Creating data source ${chalk.cyan.underline(dataSource.name)}`;
      const connectionString = await resolveSecret(dataSource.connectionString);
      await searchIndexerClient.createDataSourceConnection({
        ...dataSource,
        connectionString,
      });
      await delay();
    } catch (e) {
      spinner.text = `Failed to create data source ${chalk.cyan.underline(dataSource.name)}`;
      console.error(e);
      process.exit(1);
    }
  }

  for await (const indexer of migrationPlan.indexers.create) {
    try {
      spinner.text = `Creating indexer ${chalk.cyan.underline(indexer.name)}`;
      await searchIndexerClient.createIndexer(indexer);
      await delay();
    } catch (e) {
      spinner.text = `Failed to delete indexer ${chalk.cyan.underline(indexer.name)}`;
      console.error(e);
      process.exit(1);
    }
  }

  spinner.succeed("Migration plan applied.");
}
