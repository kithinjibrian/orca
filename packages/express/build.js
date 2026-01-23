import * as esbuild from "esbuild";
import { execSync } from "child_process";
import path from "path";

const isWatch = process.argv.includes("--watch");

const buildConfigs = [
  {
    bundle: true,
    sourcemap: true,
    minify: false,
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.mjs",
    platform: "node",
    format: "esm",
    target: ["node18"],
    packages: "external",
  },
];

async function build() {
  try {
    execSync("rm -rf dist", { stdio: "inherit" });

    for (const config of buildConfigs) {
      console.log(`Building ${config.outfile}...`);

      if (isWatch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
        console.log(`Watching ${config.outfile}...`);
      } else {
        await esbuild.build(config);
      }
    }

    console.log("Generating TypeScript declarations...");
    execSync("npx tsc", {
      stdio: "inherit",
    });

    if (!isWatch) {
      console.log("Build successful!");
    } else {
      console.log("Initial build complete. Watching for changes...");
    }
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
  }
}

build();
