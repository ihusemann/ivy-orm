import chalk from "chalk";
import { ResourceType } from "./types";
import { existsSync, mkdirSync } from "fs";
import path from "path";

export function displayMigrationChanges(
  migrationPart: { create: any[]; delete: any[] },
  resourceType: ResourceType,
  updatedResources: any[]
) {
  if (migrationPart.create.length > 0 || migrationPart.delete.length > 0) {
    console.log(`\n${chalk.cyan(`${resourceType}s:`)}`);

    migrationPart.delete.forEach(({ name }: { name: string }) => {
      console.log(`  ${chalk.redBright("-")} ${name}`);
    });

    migrationPart.create.forEach(({ name }: { name: string }) => {
      const isModified = updatedResources.some(
        (resource) => resource.name === name
      );
      console.log(
        `  ${chalk.greenBright("+")} ${name} ${
          isModified ? chalk.gray("(modified)") : ""
        }`
      );
    });
  }
}

export function ensureMigrationsDirectory(
  cwd: string,
  schema: string,
  out: string
) {
  const migrationDirectoryPath = path.join(
    path.dirname(path.join(cwd, schema)),
    out
  );
  try {
    if (!existsSync(migrationDirectoryPath)) {
      mkdirSync(migrationDirectoryPath);
    }

    return migrationDirectoryPath;
  } catch {
    8;
    throw new Error(
      `${chalk.red.bold("Error:")} failed to create migration directory at ${chalk.yellow(migrationDirectoryPath)}`
    );
  }
}
