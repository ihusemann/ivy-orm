import * as esbuild from "esbuild";
import { cpSync } from "fs";

esbuild.buildSync({
  entryPoints: ["./src/cli/index.ts"],
  bundle: true,
  outfile: "dist/index.cjs",
  format: "cjs",
  target: "node16",
  platform: "node",
  external: ["esbuild", "ivy-orm"],
  banner: {
    js: `#!/usr/bin/env -S node --loader @esbuild-kit/esm-loader --no-warnings`,
  },
});
