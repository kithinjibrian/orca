import { expandMacros } from "@/macros";
import type { Plugin, OnLoadArgs, OnLoadResult } from "esbuild";
import * as fs from "fs/promises";
import * as path from "path";
import { ReactConfig, transform } from "@swc/core";

interface FileMetadata {
  source: string;
  path: string;
  decorators: boolean;
}

interface CompilePluginParams {
  decorators: boolean;
}

function parseFileMetadata(
  source: string,
  path: string,
  decorators: boolean,
): FileMetadata {
  return {
    source,
    path,
    decorators,
  };
}

async function swcTransform(
  source: string,
  pathStr: string,
  tsx: boolean = false,
  react?: ReactConfig,
): Promise<OnLoadResult> {
  const resolveDir = path.dirname(pathStr);

  const swcResult = await transform(source, {
    filename: pathStr,
    jsc: {
      parser: {
        syntax: "typescript",
        tsx,
        decorators: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
        react,
      },
      target: "esnext",
    },
    isModule: true,
  });

  return {
    contents: swcResult.code,
    loader: "js",
    resolveDir,
  };
}

class BuildTransformer {
  async transformTypeScript(
    source: string,
    path: string,
  ): Promise<OnLoadResult> {
    return swcTransform(source, path);
  }

  async process(metadata: FileMetadata): Promise<OnLoadResult> {
    const expandedSource = await expandMacros(metadata.source, metadata.path);
    const expandedMetadata = { ...metadata, source: expandedSource };
    const { source, path, decorators } = expandedMetadata;

    if (!decorators) {
      return {
        contents: source,
        loader: "ts",
      };
    }

    return this.transformTypeScript(source, path);
  }
}

export function useCompilePlugin(options: CompilePluginParams): Plugin {
  const transformer = new BuildTransformer();

  return {
    name: "Orca",
    setup(build) {
      build.onLoad(
        { filter: /\.tsx?$/ },
        async (args: OnLoadArgs): Promise<OnLoadResult> => {
          const source = await fs.readFile(args.path, "utf8");
          const metadata = parseFileMetadata(
            source,
            args.path,
            options.decorators,
          );
          return transformer.process(metadata);
        },
      );
    },
  };
}
