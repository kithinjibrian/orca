import * as esbuild from "esbuild";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import { WebSocketServer, WebSocket } from "ws";
import { loadConfig, mergeConfig, getDefaultConfig } from "../config/config";
import { buildGraph, useMyPlugin } from "@/plugins";
import { Store } from "@/store";
import {
  HtmlPreprocessor,
  HtmlPreprocessorOptions,
  createHotReloadTransformer,
} from "../html";

interface VirtualFile {
  output: string;
  code: string;
}

const virtualClientFiles: Record<string, VirtualFile> = {
  "virtual:navigate": {
    output: "navigate",
    code: `
export async function navigate(event, url) {
  event.preventDefault();  
  
  try {
    const { Navigate, getCurrentInjector } = await import("./src/client/client.js");
    const injector = getCurrentInjector();
    
    if (injector) {
      const navigate = injector.resolve(Navigate);
      navigate.go(url);
    } else {
      window.location.href = url;
    }
  } catch (error) {
    console.error("Navigation error:", error);
    window.location.href = url;
  }
}
    `.trim(),
  },
};

function createVirtualModulePlugin(
  virtualFiles: Record<string, VirtualFile>
): esbuild.Plugin {
  return {
    name: "virtual-module",
    setup(build) {
      build.onResolve({ filter: /^virtual:/ }, (args) => {
        if (virtualFiles[args.path]) {
          return {
            path: args.path,
            namespace: "virtual",
          };
        }
      });

      build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
        const virtualFile = virtualFiles[args.path];

        if (virtualFile) {
          return {
            contents: virtualFile.code,
            loader: "js",
          };
        }
      });
    },
  };
}

class HotReloadManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(ws);
      });
    });

    console.log(`Hot reload server listening on ws://localhost:${this.port}`);
  }

  reload(): void {
    const activeClients = Array.from(this.clients).filter(
      (client) => client.readyState === WebSocket.OPEN
    );

    if (activeClients.length === 0) {
      return;
    }

    activeClients.forEach((client) => {
      try {
        client.send("reload");
      } catch (error) {
        console.error("Failed to send reload signal:", error);
        this.clients.delete(client);
      }
    });
  }

  close(): void {
    if (this.wss) {
      this.clients.forEach((client) => client.close());
      this.wss.close();
    }
  }
}

async function copyAndProcessHtml(
  hotReloadPort: number,
  preprocessorOptions?: HtmlPreprocessorOptions
): Promise<void> {
  try {
    await fs.mkdir("public", { recursive: true });

    const preprocessor = new HtmlPreprocessor({
      transformers: [createHotReloadTransformer(hotReloadPort)],
      injectScripts: ["./navigate.js"],
      ...preprocessorOptions,
    });

    await preprocessor.processFile(
      "./src/client/index.html",
      "./public/index.html"
    );
  } catch (error) {
    console.error("Failed to copy and process index.html:", error);
    throw error;
  }
}

async function cleanDirectories(): Promise<void> {
  await Promise.all([
    fs.rm("dist", { recursive: true, force: true }),
    fs.rm("public", { recursive: true, force: true }),
  ]);
}

function createRestartServerPlugin(
  serverProcess: { current: ChildProcess | null },
  onServerBuildComplete: () => void,
  hotReloadManager: HotReloadManager
): esbuild.Plugin {
  return {
    name: "restart-server",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length > 0) {
          console.error(
            `Server build failed with ${result.errors.length} error(s)`
          );
          return;
        }

        if (serverProcess.current) {
          serverProcess.current.kill("SIGTERM");
        }

        serverProcess.current = spawn("node", ["dist/main.js"], {
          stdio: "inherit",
        });

        serverProcess.current.on("error", (err) => {
          console.error("Server process error:", err);
        });

        setTimeout(() => {
          hotReloadManager.reload();
        }, 500);

        onServerBuildComplete();
      });
    },
  };
}

export async function startDevServer(): Promise<void> {
  const store = Store.getInstance();
  const userConfig = await loadConfig();
  const config = mergeConfig(getDefaultConfig(), userConfig);

  const HOT_RELOAD_PORT = 3001;
  const hotReloadManager = new HotReloadManager(HOT_RELOAD_PORT);

  await cleanDirectories();
  await copyAndProcessHtml(HOT_RELOAD_PORT, config.htmlPreprocessor);

  hotReloadManager.start();

  const entryPoints = ["src/main.ts"];
  const clientFiles = new Set<string>(["src/client/client.tsx"]);
  const serverProcessRef = { current: null as ChildProcess | null };
  let clientCtx: esbuild.BuildContext | null = null;
  let virtualCtx: esbuild.BuildContext | null = null;
  let isShuttingDown = false;

  let pendingClientFiles = new Set<string>();
  let needsClientRebuild = false;

  async function buildVirtualFiles(): Promise<void> {
    if (isShuttingDown) return;

    try {
      if (virtualCtx) {
        await virtualCtx.dispose();
        virtualCtx = null;
      }

      const virtualEntryPoints: Record<string, string> = {};
      Object.entries(virtualClientFiles).forEach(([key, value]) => {
        virtualEntryPoints[value.output] = key;
      });

      virtualCtx = await esbuild.context({
        entryPoints: virtualEntryPoints,
        bundle: true,
        outdir: "public",
        platform: "browser",
        format: "iife",
        globalName: "Orca",
        sourcemap: config.build?.sourcemap ?? true,
        minify: config.build?.minify ?? false,
        plugins: [createVirtualModulePlugin(virtualClientFiles)],
        write: true,
      });

      await virtualCtx.rebuild();
    } catch (error) {
      console.error("Failed to build virtual files:", error);
      throw error;
    }
  }

  async function rebuildClient(): Promise<void> {
    if (isShuttingDown) return;

    try {
      if (clientCtx) {
        await clientCtx.dispose();
        clientCtx = null;
      }

      if (clientFiles.size === 0) return;

      const entryPoints = Array.from(clientFiles);
      const graph = buildGraph(entryPoints);

      clientCtx = await esbuild.context({
        entryPoints,
        bundle: true,
        outdir: "public",
        outbase: ".",
        platform: "browser",
        format: "esm",
        sourcemap: config.build?.sourcemap ?? true,
        splitting: true,
        minify: config.build?.minify ?? false,
        plugins: [
          ...(config.plugins?.map((cb) => cb(store)) || []),
          ...(config.client_plugins?.map((cb) => cb(store)) || []),
          useMyPlugin({
            graph,
            isServerBuild: false,
            onClientFound: () => {},
          }),
          {
            name: "client-build-logger",
            setup(build: any) {
              build.onEnd((result: any) => {
                if (result.errors.length > 0) {
                  console.error(
                    `Client build failed with ${result.errors.length} error(s)`
                  );
                } else {
                  console.log("Client build completed");
                  hotReloadManager.reload();
                }
              });
            },
          },
        ],
        write: true,
      });

      await clientCtx.watch();
      pendingClientFiles.clear();
      needsClientRebuild = false;
    } catch (error) {
      console.error("Failed to rebuild client:", error);
      throw error;
    }
  }

  async function onServerBuildComplete(): Promise<void> {
    if (needsClientRebuild && pendingClientFiles.size > 0) {
      await rebuildClient();
    }
  }

  const serverCtx = await esbuild.context({
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
      useMyPlugin({
        isServerBuild: true,
        onClientFound: async (filePath) => {
          const isNewFile = !clientFiles.has(filePath);

          if (isNewFile) {
            clientFiles.add(filePath);
            pendingClientFiles.add(filePath);
            needsClientRebuild = true;
          }
        },
      }),
      createRestartServerPlugin(
        serverProcessRef,
        onServerBuildComplete,
        hotReloadManager
      ),
    ],
    write: true,
  });

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\nShutting down dev server...");

    try {
      if (serverProcessRef.current) {
        serverProcessRef.current.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await serverCtx.dispose();
      if (clientCtx) await clientCtx.dispose();
      if (virtualCtx) await virtualCtx.dispose();
      hotReloadManager.close();

      console.log("Dev server shut down successfully");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Starting dev server...");

  await buildVirtualFiles();

  await serverCtx.watch();
}
