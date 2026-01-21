import { getDefaultConfig, loadConfig, mergeConfig } from "@/config";
import { useCompilePlugin } from "@/plugins";
import { Store } from "@/store";
import * as esbuild from "esbuild";
import { execSync } from "child_process";

export async function compileFiles(entryPoints: string[]): Promise<void> {
  const store = Store.getInstance();
  const userConfig = await loadConfig();
  const config = mergeConfig(getDefaultConfig(), userConfig);

  await esbuild.build({
    entryPoints,
    bundle: true,
    outdir: config.build?.outDir || "dist",
    platform: "node",
    format: "esm",
    packages: "external",
    sourcemap: config.build?.sourcemap ?? true,
    minify: config.build?.minify ?? false,
    plugins: [
      ...(config.plugins?.map((cb) => cb(store)) || []),
      useCompilePlugin({
        decorators: config.build?.decorators ?? false,
      }),
    ],
    write: true,
  });

  if (config.build?.types) {
    execSync("npx tsc", {
      stdio: "inherit",
    });
  }
}
