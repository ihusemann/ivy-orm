import { AnyIndex, AnyIndexer, isIndex, isIndexer } from "ivy-orm";
import chalk from "chalk";

export const error = (error: string, greyMsg: string = ""): string => {
  return `${chalk.bgRed.bold(" Error ")} ${error} ${greyMsg ? chalk.grey(greyMsg) : ""}`.trim();
};

export type Foo = {
  hello: string;
};

// NextJs default config is target: es5, which esbuild-register can't consume
const assertES5 = async (unregister: () => void) => {
  try {
    require("./_es5.ts");
  } catch (e: any) {
    if ("errors" in e && Array.isArray(e.errors) && e.errors.length > 0) {
      const es5Error =
        (e.errors as any[]).filter((it) =>
          it.text?.includes(`("es5") is not supported yet`)
        ).length > 0;
      if (es5Error) {
        console.log(
          error(
            `Please change compilerOptions.target from 'es5' to 'es6' or above in your tsconfig.json`
          )
        );
        process.exit(1);
      }
    }
    console.error(e);
    process.exit(1);
  }
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

  // has to be outside try catch to be able to run with tsx
  await assertES5(res.unregister);
  return res;
};

function prepareExports(exports: Record<string, unknown>) {
  const indexes: [string, AnyIndex][] = [];
  const indexers: [string, AnyIndexer][] = [];

  Object.entries(exports).forEach(([name, i]) => {
    if (isIndexer(i)) {
      indexers.push([name, i]);
      return;
    }

    if (isIndex(i)) {
      indexes.push([name, i]);
      return;
    }
  });

  return {
    indexes: Object.fromEntries(indexes),
    indexers: Object.fromEntries(indexers),
  };
}

export const readSchema = async (filepath: string) => {
  const { unregister } = await safeRegister();
  const i0: Record<string, unknown> = require(filepath);

  const exports = prepareExports(i0);

  unregister();
  return exports;
};
