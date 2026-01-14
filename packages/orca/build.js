const esbuild = require("esbuild");
const esbuildPluginTsc = require("esbuild-plugin-tsc");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const pkg = require("./package.json");

const nodeExternals = ["express", "socket.io", "fs", "path", "child_process"];
const allDependencies = Object.keys(pkg.dependencies || {});

if (fs.existsSync("dist")) {
  fs.rmSync("dist", { recursive: true });
}

const commonOptions = {
  bundle: true,
  sourcemap: true,
  minify: false,
  treeShaking: true,
  plugins: [esbuildPluginTsc()],
};

async function build() {
  try {
    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/index.node.ts"],
      platform: "node",
      format: "cjs",
      outfile: "dist/node/index.cjs",
      packages: "external",
      conditions: ["node"],
    });

    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/index.node.ts"],
      platform: "node",
      format: "esm",
      outfile: "dist/node/index.mjs",
      packages: "external",
      conditions: ["node", "module"],
    });

    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/index.browser.ts"],
      platform: "browser",
      format: "iife",
      globalName: pkg.name.replace(/[^a-zA-Z0-9]/g, ""),
      outfile: "dist/browser/index.iife.js",
      external: [...allDependencies, ...nodeExternals],
      conditions: ["browser", "default"],
    });

    await esbuild.build({
      ...commonOptions,
      entryPoints: ["src/index.browser.ts"],
      platform: "browser",
      format: "esm",
      outfile: "dist/browser/index.mjs",
      external: [...nodeExternals],
      conditions: ["browser", "module", "default"],
    });

    console.log("\nGenerating type declarations...");

    execSync(
      "npx tsc --emitDeclarationOnly --declaration --outDir dist/types",
      {
        stdio: "inherit",
      }
    );

    console.log("Type declarations generated in dist/types");

    console.log("\nAll builds completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
