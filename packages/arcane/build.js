import * as esbuild from "esbuild";
import { execSync } from "child_process";

async function build() {
  await esbuild.build({
    bundle: true,
    sourcemap: true,
    minify: false,
    entryPoints: ["src/index.node.ts"],
    platform: "node",
    format: "esm",
    outfile: "dist/node/index.mjs",
    packages: "external",
    conditions: ["node"],
  });

  await esbuild.build({
    bundle: true,
    sourcemap: true,
    minify: false,
    entryPoints: ["src/index.node.ts"],
    platform: "node",
    format: "cjs",
    outfile: "dist/node/index.cjs",
    packages: "external",
    conditions: ["node"],
  });

  // await esbuild.build({
  //   bundle: true,
  //   sourcemap: true,
  //   minify: false,
  //   entryPoints: ["src/index.browser.ts"],
  //   platform: "browser",
  //   format: "esm",
  //   outfile: "dist/browser/index.mjs",
  //   external: [],
  //   conditions: ["browser", "module", "default"],
  // });

  execSync("npx tsc --emitDeclarationOnly --declaration --outDir dist/types", {
    stdio: "inherit",
  });
}

build();
