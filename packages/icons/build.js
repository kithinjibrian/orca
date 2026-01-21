import * as esbuild from "esbuild";
import * as fs from "fs";
import { execSync } from "child_process";
import { useMyPlugin } from "@kithinji/pod";

if (fs.existsSync("dist")) {
  fs.rmSync("dist", { recursive: true });
}

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
    plugins: [
      useMyPlugin({
        isServerBuild: true,
        onClientFound: () => {},
      }),
    ],
  });

  await esbuild.build({
    bundle: true,
    sourcemap: true,
    minify: false,
    entryPoints: ["src/index.browser.ts"],
    platform: "browser",
    format: "esm",
    outfile: "dist/browser/index.mjs",
    external: ["express", "socket.io", "http", "path", "fs"],
    conditions: ["browser", "module", "default"],
    plugins: [
      useMyPlugin({
        isServerBuild: true,
        onClientFound: () => {},
      }),
    ],
  });

  execSync("npx tsc --emitDeclarationOnly --declaration --outDir dist/types", {
    stdio: "inherit",
  });
}

build();
