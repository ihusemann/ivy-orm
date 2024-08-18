import * as esbuild from "esbuild";
import * as tsup from "tsup";

esbuild.buildSync({
  entryPoints: ["./src/cli/index.ts"],
  bundle: true,
  outfile: "dist/bin.cjs",
  format: "cjs",
  target: "node16",
  platform: "node",
  external: ["esbuild", "ivy-orm", "fs"],
  banner: {
    js: `#!/usr/bin/env node`,
  },
});

const main = async () => {
  await tsup.build({
    entryPoints: ["./src/index.ts"],
    outDir: "./dist",
    splitting: false,
    dts: true,
    format: ["cjs", "esm"],
    outExtension: (ctx) => {
      if (ctx.format === "cjs") {
        return {
          dts: ".d.ts",
          js: ".js",
        };
      }
      return {
        dts: ".d.mts",
        js: ".mjs",
      };
    },
  });
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
