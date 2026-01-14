import * as path from "path";
import { pathToFileURL } from "url";
import * as fs from "fs/promises";
import { Store } from "@/store";
import type { Plugin } from "esbuild";
import { HtmlPreprocessorOptions } from "@/html";

export type PodPlugin = (store: Store) => Plugin;

export interface PodConfig {
  name: string;
  build?: {
    outDir?: string;
    sourcemap?: boolean;
    minify?: boolean;
  };
  plugins?: Array<PodPlugin>;
  client_plugins?: Array<PodPlugin>;
  server_plugins?: Array<PodPlugin>;
  htmlPreprocessor?: HtmlPreprocessorOptions;
}

const CONFIG_FILES = [
  "pod.config.js",
  "pod.config.mjs",
  "pod.config.ts",
  "pod.config.mts",
];

export async function loadConfig(
  root: string = process.cwd()
): Promise<PodConfig> {
  for (const configFile of CONFIG_FILES) {
    const configPath = path.resolve(root, configFile);

    try {
      await fs.access(configPath);

      if (configFile.endsWith(".ts") || configFile.endsWith(".mts")) {
        return await loadTsConfig(configPath);
      }

      return await loadJsConfig(configPath);
    } catch (error) {
      continue;
    }
  }

  return getDefaultConfig();
}

async function loadJsConfig(configPath: string): Promise<PodConfig> {
  try {
    const fileUrl = pathToFileURL(configPath).href;

    const configModule = await import(`${fileUrl}?t=${Date.now()}`);

    const config = configModule.default || configModule;

    if (typeof config === "function") {
      return await config();
    }

    return config;
  } catch (error) {
    console.error(`❌ Failed to load config from ${configPath}:`, error);
    throw error;
  }
}

async function loadTsConfig(configPath: string): Promise<PodConfig> {
  try {
    const esbuild = await import("esbuild");

    const result = await esbuild.build({
      entryPoints: [configPath],
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      sourcemap: "inline",
      packages: "external",
    });

    const tempFile = `${configPath}.${Date.now()}.mjs`;
    await fs.writeFile(tempFile, result.outputFiles[0].text);

    try {
      const fileUrl = pathToFileURL(tempFile).href;

      const configModule = await import(fileUrl);

      const config = configModule.default || configModule;

      if (typeof config === "function") {
        return await config();
      }

      return config;
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  } catch (error) {
    console.error(
      `❌ Failed to load TypeScript config from ${configPath}:`,
      error
    );
    throw error;
  }
}

export function getDefaultConfig(): PodConfig {
  return {
    name: "app",
    build: {
      outDir: "dist",
      sourcemap: true,
      minify: false,
    },
    plugins: [],
    client_plugins: [],
    server_plugins: [],
  };
}

export function mergeConfig(
  defaults: PodConfig,
  userConfig: PodConfig
): PodConfig {
  return {
    name: userConfig.name,
    build: { ...defaults.build, ...userConfig.build },
    plugins: [...(defaults.plugins || []), ...(userConfig.plugins || [])],
    client_plugins: [
      ...(defaults.client_plugins || []),
      ...(userConfig.client_plugins || []),
    ],
    server_plugins: [
      ...(defaults.server_plugins || []),
      ...(userConfig.server_plugins || []),
    ],
  };
}
