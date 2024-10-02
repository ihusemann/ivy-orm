import chalk from "chalk";
import { Adapter } from "./migrate";

export function ensureAdapter(adapter?: Adapter): asserts adapter is Adapter {
  if (!adapter) {
    throw new Error(
      `${chalk.red.bold("Error:")} ${chalk.yellow("adapter")} must be defined in ${chalk.green("ivy-kit.config.ts")} to use migrate.  Aborting.`
    );
  }
}
