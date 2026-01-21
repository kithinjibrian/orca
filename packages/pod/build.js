import * as esbuild from "esbuild";
import { execSync } from "child_process";

async function build() {
  await esbuild.build({
    bundle: true,
    sourcemap: true,
    minify: false,
    entryPoints: ["src/index.ts"],
    platform: "node",
    format: "esm",
    outdir: "dist",
    packages: "external",
    conditions: ["node"],
  });

  execSync("npx tsc --emitDeclarationOnly --declaration --outDir dist/types", {
    stdio: "inherit",
  });
}

build();
